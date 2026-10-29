const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v', '.gifv']
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp', '.tiff']
const processed = new WeakSet<object>()

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

function makeVideoThumbnail(url: string): string {
	if (!url) return url
	const out = url.replace('cdn.discordapp.com', 'media.discordapp.net')
	if (out.includes('media.discordapp.net') || out.includes('images-ext')) {
		return out + (out.includes('?') ? '&' : '?') + 'format=jpeg'
	}
	return url
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
			const mod = revenge.modules.finders.lookupModule(revenge.modules.finders.filters.withProps('isAnimatedImageSource'))?.[0]
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
		unsubAnimated = revenge.modules.metro.onAnyModuleInitialized((_id: any, exports: any) => {
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
			() => revenge.modules.finders.lookupModule(revenge.modules.finders.filters.withProps('addFavoriteGIF'))?.[0],
			(mod) => revenge.patcher.before(mod, 'addFavoriteGIF', (args: any[]) => {
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
