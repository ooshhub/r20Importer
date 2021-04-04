export default class TestMenu extends FormApplication {

	/**@override */
	static get defaultOptions() {
		return {
			...super.defaultOptions,
			id: "testMenu",
			classes: ["test", "testMenu"],
            title: "Work you cunt",
            template: "./modules/r20import/templates/test.html",
            width: 500,
            height: 500,
		}
	}

	async getData() {
		let data = {
			name: "testName"
		}
		return data;
	}
}