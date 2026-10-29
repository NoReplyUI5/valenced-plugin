const HOUSES = [
	{ id: 1, label: 'Bravery', subLabel: 'House of Bravery' },
	{ id: 2, label: 'Brilliance', subLabel: 'House of Brilliance' },
	{ id: 3, label: 'Balance', subLabel: 'House of Balance' },
	{ id: 0, label: 'Remove Badge', subLabel: 'Remove your HypeSquad badge' },
]

function getHttp(): any {
	return revenge.modules.finders.lookupModule(
		revenge.modules.finders.filters.withProps('getAPIBaseURL', 'get', 'post'),
	)?.[0]
}

async function applyHouse(id: number): Promise<void> {
	const http = getHttp()
	if (!http) throw new Error('HTTP module not found')
	if (id === 0) {
		await http.del({ url: '/hypesquad/online' })
	} else {
		await http.post({ url: '/hypesquad/online', body: { house_id: id }, oldFormErrors: true })
	}
}


function getCurrentHouseId(): number {
	const { filters, lookupModule } = revenge.modules.finders
	const userStore = lookupModule(filters.withProps('getCurrentUser'))?.[0]
	const flags: number = userStore?.getCurrentUser?.()?.flags ?? 0
	if (flags & 64) return 1   // Bravery
	if (flags & 128) return 2  // Brilliance
	if (flags & 256) return 3  // Balance
	return 0
}

function Settings() {
	const { React } = revenge.react
	const { ScrollView } = revenge.react.ReactNative
	const { Page } = (revenge as any).components
	const { TableRowGroup, TableRadioGroup, TableRadioRow } = (revenge as any).discord?.design?.Design ?? {}

	const [pending, setPending] = React.useState(false)
	const [status, setStatus] = React.useState<string | null>(null)

	async function select(id: number) {
		if (pending) return
		setPending(true)
		setStatus(null)
		try {
			await applyHouse(id)
			setStatus('Done!')
		} catch (e: any) {
			setStatus(e?.message ?? String(e))
		} finally {
			setPending(false)
		}
	}

	if (!TableRowGroup || !TableRadioGroup || !TableRadioRow) return null

	return React.createElement(
		Page,
		null,
		React.createElement(
			ScrollView,
			{ contentContainerStyle: { paddingTop: 16, paddingBottom: 40, gap: 16 } },
			React.createElement(
				TableRowGroup,
				{ title: status ? `Choose Your House - ${status}` : 'Choose Your House' },
				React.createElement(
					TableRadioGroup,
					{ onChange: (v: string) => select(Number(v)), defaultValue: String(getCurrentHouseId()) },
					...HOUSES.map(house =>
						React.createElement(TableRadioRow, {
							key: house.id,
							label: house.label,
							subLabel: house.subLabel,
							value: String(house.id),
						}),
					),
				),
			),
		),
	)
}

export default plugin({
	start({ cleanup }) {
		cleanup(() => {})
	},
	SettingsComponent: Settings,
})
