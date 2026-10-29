import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { onAnyModuleInitialized } from '@valenced/modules/metro'
import { before } from '@valenced/patcher'

const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v', '.gifv']
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp', '.tiff']

function isVideo(url: string): boolean {
	if (!url) return false
	const path = url.split('?')[0].toLowerCase()
	return VIDEO_EXT.some(e => path.endsWith(e))
}

function isImage(url: string): boolean {
	if (!url) return false
	const path = url.split('?')[0].toLowerCase()
	return IMAGE_EXT.some(e => path.endsWith(e))
}

function tryPatchModule(
	getModule: () => any,
	doPatch: (mod: any) => (() => void) | null,
	retries = 0,
	maxRetries = 60,
	interval = 500,
): { cancel: () => void } {
	let timeout: ReturnType<typeof setTimeout> | null = null
	let unpatch: (() => void) | null = null
	let cancelled = false

	function attempt() {
		if (cancelled) return
		const mod = getModule()
		if (mod) {
			unpatch = doPatch(mod)
			return
		}
		if (retries++ < maxRetries) {
			timeout = setTimeout(attempt, interval)
		}
	}

	attempt()
	return {
		cancel() {
			cancelled = true
			if (timeout) { clearTimeout(timeout); timeout = null }
			unpatch?.()
		},
	}
}

export default plugin({
	start({ cleanup }) {
		const patches: Array<{ cancel: () => void }> = []

		// Gate 1: isAnimatedImageSource — patch on load via subscription so lazy modules are covered
		let unsubAnimated: (() => void) | null = null
		let unpatchAnimated: (() => void) | null = null

		function patchAnimated() {
			const mod = lookupModule(withProps('isAnimatedImageSource'))?.[0]
			if (!mod || unpatchAnimated) return
			const orig = mod.isAnimatedImageSource
			mod.isAnimatedImageSource = function (source: any) {
				const url: string = source?.uri || source?.sourceURI || ''
				if (url && (isVideo(url) || isImage(url) || source?.isGIFV)) return true
				return orig.call(this, source)
			}
			unpatchAnimated = () => { mod.isAnimatedImageSource = orig }
		}

		// Try immediately (already loaded), then subscribe for lazy load
		patchAnimated()
		unsubAnimated = onAnyModuleInitialized((_id: any, exports: any) => {
			if (exports?.isAnimatedImageSource) patchAnimated()
		})

		patches.push({
			cancel() {
				unsubAnimated?.()
				unpatchAnimated?.()
			},
		})

		// addFavoriteGIF: set format=2 for videos
		patches.push(tryPatchModule(
			() => lookupModule(withProps('addFavoriteGIF'))?.[0],
			(mod) => before(mod, 'addFavoriteGIF', (args: any[]) => {
				const data = args[0]
				if (data && typeof data === 'object') {
					const url: string = data.url || data.src || ''
					if (isVideo(url)) data.format = 2
					else if (data.format === 2) data.format = 1
				}
				return args
			}),
		))

		cleanup(() => { for (const p of patches) p.cancel() })
	},
})
