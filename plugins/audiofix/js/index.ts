export default plugin({
	jsonStorage: {
		load: true,
		default: {},
	},
	start({ cleanup, jsonStorage, plugin }) {
		const audioManager =
			valenced.react.ReactNative.TurboModuleRegistry.get('NativeAudioManagerModule') ??
			valenced.react.ReactNative.TurboModuleRegistry.get('RTNAudioManager')

		if (!audioManager) {
			console.log('[audiofix] Audio manager module not found')
			return
		}

		const original = audioManager.setCommunicationModeOn
		audioManager.setCommunicationModeOn = () => {}

		cleanup(() => {
			audioManager.setCommunicationModeOn = original
			console.log('[audiofix] Restored setCommunicationModeOn')
		})

		console.log('[audiofix] Patched setCommunicationModeOn')

		if (plugin.startedLate) {
			plugin.requireReload()
		}
	},
})
