let msg: any = null
let getCopyIcon: () => any = () => null

function hideSheet() {
	try {
		revenge.discord.actions?.ActionSheetActionCreators?.hideActionSheet?.()
	} catch {}
}

function isRowArray(arr: any[]): boolean {
	if (arr.length === 0) return false
	const first = arr[0]
	return (
		first?.type?.name === 'ActionSheetRow' ||
		(first?.props && typeof first.props.label === 'string')
	)
}

function walkRows(tree: any, out: any[] = []): any[] {
	if (!tree || typeof tree !== 'object') return out
	if (Array.isArray(tree)) {
		if (isRowArray(tree) && !out.includes(tree)) out.push(tree)
		tree.forEach((c: any) => walkRows(c, out))
		return out
	}
	const k = tree?.props?.children
	if (Array.isArray(k)) {
		if (isRowArray(k) && !out.includes(k)) out.push(k)
		k.forEach((c: any) => walkRows(c, out))
	} else {
		walkRows(k, out)
	}
	return out
}

function makeIconGetter(name: string): () => any {
	const wg = (revenge as any).utils?.discord?.withGeneratedIconComponent
	const filter = wg ? wg(name) : revenge.modules.finders.filters.withProps(name)
	let cached: any = null
	let unsub: (() => void) | undefined
	try {
		unsub = revenge.modules.finders.getModules(
			filter,
			(exports: any) => {
				const val = exports?.[name] ?? exports?.default ?? exports
				if (val) { cached = val; unsub?.() }
			},
			{ returnNamespace: true },
		)
	} catch {}
	return () => cached
}

function makeRow(tpl: any, label: string, icon: any, onPress: () => void): any {
	const { React } = revenge.react
	const Row = tpl?.type
	if (!Row) return null
	const Icon = Row?.Icon
	const iconEl = Icon && icon ? React.createElement(Icon, { IconComponent: icon }) : null
	return React.createElement(Row, { key: label, label, icon: iconEl, onPress })
}

function inject(res: any): any {
	if (!res || !msg?.author?.id) return res

	const groups = walkRows(res)
	if (groups.length === 0) return res

	const rowArr = groups[0]
	const tpl = rowArr?.find?.((r: any) => r?.props?.label != null) ?? rowArr?.[0]
	if (!tpl) return res

	const userId = msg.author.id
	const row = makeRow(tpl, 'Copy User ID', getCopyIcon(), () => {
		hideSheet()
		revenge.react.ReactNative.Clipboard.setString(userId)
		try {
			revenge.discord.actions?.ToastActionCreators?.showToast?.({
				content: 'User ID copied!',
			})
		} catch {}
	})
	if (row) rowArr.unshift(row)

	return res
}

function installWrapper(ns: any) {
	const mod = ns?.default ?? ns
	if (typeof mod !== 'function') return () => {}
	const orig = mod
	const wrapped = (props: any) => {
		const res = orig(props)
		try {
			return msg ? inject(res) : res
		} catch {
			return res
		}
	}
	ns.default = wrapped
	return () => {
		if (ns.default === wrapped) ns.default = orig
	}
}

function onImportedPath(path: string, cb: (ns: any) => void): () => void {
	try {
		return (
			revenge.discord.utils.modules.finders.getModuleWithImportedPath(
				path,
				(ns: any) => cb(ns),
			) ?? (() => {})
		)
	} catch {
		return () => {}
	}
}

export default plugin({
	start({ cleanup }) {
		getCopyIcon = makeIconGetter('CopyIcon')
		const unpatch: Array<() => void> = []

		unpatch.push(
			onImportedPath(
				'modules/action_sheet/native/ActionSheetActionCreators.tsx',
				(ns: any) => {
					const owner = ns?.default ?? ns
					if (typeof owner?.openLazy !== 'function') return
					unpatch.push(
						revenge.patcher.before(owner, 'openLazy', (args: any) => {
							const [, key, loc] = args ?? []
							msg = key === 'MessageLongPressActionSheet' ? (loc?.message ?? null) : null
							return args
						}),
					)
				},
			),
		)

		unpatch.push(
			onImportedPath(
				'modules/messages/native/long_press/LongPressMessageActionSheet.tsx',
				(ns: any) => {
					unpatch.push(installWrapper(ns))
				},
			),
		)

		cleanup(() => {
			for (const u of unpatch) u?.()
			msg = null
			getCopyIcon = () => null
		})
	},
})
