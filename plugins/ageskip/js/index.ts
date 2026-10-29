// Age Gate Skip
// Bypasses age-restricted server and channel confirmation prompts.

export default plugin({
	start({ cleanup }) {
		const { lookupModule, getModules, filters } = revenge.modules.finders

		const actionKeys = [
			'confirmNsfwGuild',
			'confirmAgeGate',
			'confirmNsfwChannel',
			'acknowledgeNsfwChannel',
		]

		for (const key of actionKeys) {
			const mod = lookupModule(filters.withProps(key))?.[0]
			if (mod && typeof mod[key] === 'function') {
				cleanup(revenge.patcher.instead(mod, key, () => {}))
			}
		}

		const componentNames = [
			// Server-level gates
			'NsfwGuildPrompt',
			'GuildAgeGate',
			'AgeGatePrompt',
			'NsfwGate',
			'AgeGate',
			// Channel-level gates
			'NsfwChannelPrompt',
			'ChannelAgeGate',
			'NsfwOverlay',
			'AgeGatedChannelNotice',
			'NSFWPrompt',
		]

		for (const name of componentNames) {
			getModules(filters.withName(name), (exports: any) => {
				const target = exports?.default !== undefined ? exports : { [name]: exports }
				const key = exports?.default !== undefined ? 'default' : name
				if (!target[key]) return
				cleanup(revenge.patcher.instead(target, key, () => null))
			})
		}
	},
})
