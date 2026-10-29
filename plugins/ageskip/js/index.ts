// Age Gate Skip
// Bypasses age-restricted channel confirmation prompts.

import { getModules, lookupModule } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'

export default plugin({
	start({ cleanup }) {
		const actionKeys = [
			'confirmNsfwChannel',
			'acknowledgeNsfwChannel',
		]

		for (const key of actionKeys) {
			const mod = lookupModule(withProps(key))?.[0]
			if (mod && typeof mod[key] === 'function') {
				cleanup(instead(mod, key, () => {}))
			}
		}

		const componentNames = [
			'NsfwChannelPrompt',
			'ChannelAgeGate',
			'NsfwOverlay',
			'AgeGatedChannelNotice',
			'NSFWPrompt',
		]

		for (const name of componentNames) {
			getModules(withName(name), (exports: any) => {
				const target = exports?.default !== undefined ? exports : { [name]: exports }
				const key = exports?.default !== undefined ? 'default' : name
				if (!target[key]) return
				cleanup(instead(target, key, () => null))
			})
		}
	},
})