// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// MIT License. See license.txt

frappe.breadcrumbs = {
	all: {},

	preferred: {
		File: "",
		Dashboard: "Customization",
		"Dashboard Chart": "Customization",
		"Dashboard Chart Source": "Customization"
	},

	module_map: {
		Core: "Settings",
		Email: "Settings",
		Custom: "Settings",
		Workflow: "Settings",
		Printing: "Settings",
		Setup: "Settings",
		"Event Streaming": "Tools",
		Automation: "Tools"
	},

	view_names: ["List", "Report", "Dashboard", "Gantt", "Calendar", "Kanban"],

	route_history_enabled: undefined,
	max_routes_display: 10,

	set_doctype_module(doctype, module) {
		localStorage["preferred_breadcrumbs:" + doctype] = module;
	},

	get_doctype_module(doctype) {
		return localStorage["preferred_breadcrumbs:" + doctype];
	},

	add(module, doctype, type) {
		let obj;
		if (typeof module === "object") {
			obj = module;
		} else {
			obj = {
				module: module,
				doctype: doctype,
				type: type
			};
		}
		this.all[frappe.breadcrumbs.current_page()] = obj;
		this.update();
	},

	current_page() {
		return frappe.get_route_str();
	},

	update() {
		var breadcrumbs = this.all[frappe.breadcrumbs.current_page()];

		if (!this.route_history_enabled) {
			frappe.db.get_doc("User", frappe.session.user).then(doc => {
				this.route_history_enabled = Boolean(doc["route_history_breadcrumbers"]);
				this.max_routes_display =
					doc["max_routes_display"] > 0 ? doc["max_routes_display"] : 10;
				if (this.route_history_enabled) this.update();
			});
		}

		if (this.route_history_enabled) {
			this.set_history_objects(breadcrumbs);
		} else {
			this.clear();
			if (!breadcrumbs) return this.toggle(false);

			if (breadcrumbs.type === "Custom") {
				this.set_custom_breadcrumbs(breadcrumbs);
			} else {
				// workspace
				this.set_workspace_breadcrumb(breadcrumbs);

				// form / print
				let view = frappe.get_route()[0];
				view = view ? view.toLowerCase() : null;
				if (breadcrumbs.doctype && ["print", "form"].includes(view)) {
					this.set_list_breadcrumb(breadcrumbs);
					this.set_form_breadcrumb(breadcrumbs, view);
				} else if (breadcrumbs.doctype && view === "list") {
					this.set_list_breadcrumb(breadcrumbs);
				} else if (breadcrumbs.doctype && view == "dashboard-view") {
					this.set_list_breadcrumb(breadcrumbs);
					this.set_dashboard_breadcrumb(breadcrumbs);
				}
			}
		}
		this.toggle(true);
	},

	set_current_doc_name() {
		frappe.doc_name = undefined;
		// if (
		// 	frappe.route_history[last_obj_index][2] != "List" &&
		// 	typeof frappe.route_history[last_obj_index][2] !== "undefined"
		// ) {
		// 	frappe.doc_name = frappe.route_history[last_obj_index][2];
		// }
		frappe.doc_name = frappe.route_history[frappe.route_history.length - 1].join("/");
		// frappe.doc_name = frappe.get_route().slice(2).join("/");
		return frappe.doc_name;
	},

	add_to_navbar(to_menu, url, name, title) {
		if (to_menu) {
			$(`<a class="dropdown-item" href="${url}" title="${title}">${name}</a>`).prependTo(
				this.$modal_breadcrumbs
			);
		} else {
			$(`<li title="${title}"><a href="${url}">${name}</a></li>`).prependTo(
				this.$breadcrumbs
			);
		}
	},

	get_history_path_str_by_obj(route) {
		let hist_obj_str = [route["view_name"]];
		hist_obj_str.push(route["doctype"]);
		if (route.hasOwnProperty("doc_name")) hist_obj_str.push(route["doc_name"]);
		return hist_obj_str.join("/");
	},

	set_history_objects(breadcrumbs) {
		this.set_current_doc_name();
		if (frappe.doc_name != frappe.last_route_doc) {
			// By default this.set_history_objects() executes several times. If condition needs for prevent multi execution.
			frappe
				.call("frappe.desk.doctype.route_history.route_history.route_history", {
					max_route: this.max_routes_display
				})
				.then(r => {
					frappe.last_route_doc = frappe.doc_name;
					this.clear();
					let route_history = r.message;
					if (route_history.length <= 3) {
						$("#navbar-route-history-menu").removeClass("show");
					} else {
						$("#navbar-route-history-menu").addClass("show");
					}

					let count_elem_navbar = 2;
					for (let i in route_history) {
						console.log(this.get_history_path_str_by_obj(route_history[i]));
						if (
							(!frappe.is_small_screen &&
								this.get_history_path_str_by_obj(route_history[i]) ===
									frappe.doc_name) ||
							this.get_history_path_str_by_obj(route_history[i]) ===
								"Workspaces/Home"
						) {
							if (i <= 2) count_elem_navbar++;
							continue;
						}
						let to_menu = frappe.is_small_screen || i >= count_elem_navbar;
						if (route_history[i]["view_name"] == "Form") {
							let form_route = `/app/${frappe.router.slug(
								route_history[i]["doctype"]
							)}/${route_history[i]["doc_name"]}`;
							this.add_to_navbar(
								to_menu,
								form_route,
								route_history[i]["doc_name"],
								route_history[i]["doc_title"]
							);
						} else if (route_history[i]["view_name"] == "Workspaces") {
							this.add_to_navbar(
								to_menu,
								`/app/${frappe.router.slug(route_history[i]["doctype"])}`,
								__(route_history[i]["doctype"]),
								__(route_history[i]["doctype"])
							);
						} else if (route_history[i]["view_name"] == "List") {
							let route;
							const doctype_meta = frappe.get_doc(
								"DocType",
								route_history[i]["doctype"]
							);
							const doctype_route = frappe.router.slug(route_history[i]["doctype"]);
							if (doctype_meta?.is_tree) {
								route = `${doctype_route}/view/${route_history[i]["view_name"]}`;
							} else {
								route = doctype_route;
							}
							this.add_to_navbar(
								to_menu,
								`/app/${route}`,
								__(route_history[i]["doctype"]),
								__(route_history[i]["doctype"])
							);
						}
						if (i - count_elem_navbar + 1 >= this.max_routes_display) break;
					}
					if (breadcrumbs) {
						if (breadcrumbs.type === "Custom") {
							this.set_custom_breadcrumbs(breadcrumbs);
						} else {
							let view = frappe.get_route()[0];
							view = view ? view.toLowerCase() : null;
							if (breadcrumbs.doctype && ["print", "form"].includes(view)) {
								this.set_form_breadcrumb(breadcrumbs, view);
								$(`<li>1111</li>`).appendTo(this.$breadcrumbs);
								console.log(1111);
							} else if (breadcrumbs.doctype && view === "list") {
								this.set_list_breadcrumb(breadcrumbs);
								$(`<li>2222</li>`).appendTo(this.$breadcrumbs);
								console.log(2222);
							} else if (breadcrumbs.doctype && view == "dashboard-view") {
								this.set_list_breadcrumb(breadcrumbs);
								this.set_dashboard_breadcrumb(breadcrumbs);
								$(`<li>3333</li>`).appendTo(this.$breadcrumbs);
								console.log(3333);
							}
						}
					}

					if (frappe.is_small_screen)
						this.add_to_navbar(true, "/app/", __("Home"), __("Home"));
				});
		}
	},

	set_custom_breadcrumbs(breadcrumbs) {
		const html = `<li><a href="${breadcrumbs.route}">${breadcrumbs.label}</a></li>`;
		this.$breadcrumbs.append(html);
	},

	get last_route() {
		return frappe.route_history.slice(-2)[0];
	},

	set_workspace_breadcrumb(breadcrumbs) {
		// get preferred module for breadcrumbs, based on history and module

		if (!breadcrumbs.workspace) {
			this.set_workspace(breadcrumbs);
		}
		if (!breadcrumbs.workspace) {
			return;
		}

		if (
			breadcrumbs.module_info &&
			(breadcrumbs.module_info.blocked ||
				!frappe.visible_modules.includes(breadcrumbs.module_info.module))
		) {
			return;
		}

		$(
			`<li><a href="/app/${frappe.router.slug(breadcrumbs.workspace)}">${__(
				breadcrumbs.workspace
			)}</a></li>`
		).appendTo(this.$breadcrumbs);
	},

	set_workspace(breadcrumbs) {
		// try and get module from doctype or other settings
		// then get the workspace for that module

		this.setup_modules();
		var from_module = this.get_doctype_module(breadcrumbs.doctype);

		if (from_module) {
			breadcrumbs.module = from_module;
		} else if (this.preferred[breadcrumbs.doctype] !== undefined) {
			// get preferred module for breadcrumbs
			breadcrumbs.module = this.preferred[breadcrumbs.doctype];
		}

		// guess from last route
		if (this.last_route?.[0] == "Workspaces") {
			let last_workspace = this.last_route[1];

			if (
				breadcrumbs.module &&
				frappe.boot.module_wise_workspaces[breadcrumbs.module]?.includes(last_workspace)
			) {
				breadcrumbs.workspace = last_workspace;
				return;
			}
		}

		if (breadcrumbs.module) {
			if (this.module_map[breadcrumbs.module]) {
				breadcrumbs.module = this.module_map[breadcrumbs.module];
			}

			breadcrumbs.module_info = frappe.get_module(breadcrumbs.module);

			// set workspace
			if (
				breadcrumbs.module_info &&
				frappe.boot.module_wise_workspaces[breadcrumbs.module]
			) {
				breadcrumbs.workspace = frappe.boot.module_wise_workspaces[breadcrumbs.module][0];
			}
		}
	},

	set_list_breadcrumb(breadcrumbs) {
		const doctype = breadcrumbs.doctype;
		const doctype_meta = frappe.get_doc("DocType", doctype);
		if (
			(doctype === "User" && !frappe.user.has_role("System Manager")) ||
			doctype_meta?.issingle
		) {
			// no user listview for non-system managers and single doctypes
		} else {
			let route;
			const doctype_route = frappe.router.slug(frappe.router.doctype_layout || doctype);
			if (doctype_meta?.is_tree) {
				let view = frappe.model.user_settings[doctype].last_view || "Tree";
				route = `${doctype_route}/view/${view}`;
			} else {
				route = doctype_route;
			}
			$(`<li><a href="/app/${route}">${__(doctype)}</a></li>`).appendTo(this.$breadcrumbs);
		}
	},

	set_form_breadcrumb(breadcrumbs, view) {
		const doctype = breadcrumbs.doctype;
		const docname = frappe
			.get_route()
			.slice(2)
			.join("/");
		let form_route = `/app/${frappe.router.slug(doctype)}/${docname}`;
		$(`<li><a href="${form_route}">${__(docname)}</a></li>`).appendTo(this.$breadcrumbs);

		if (view === "form") {
			let last_crumb = this.$breadcrumbs.find("li").last();
			last_crumb.addClass("disabled");
			last_crumb.css("cursor", "copy");
			last_crumb.click(event => {
				event.stopImmediatePropagation();
				frappe.utils.copy_to_clipboard(last_crumb.text());
			});
		}
	},

	set_dashboard_breadcrumb(breadcrumbs) {
		const doctype = breadcrumbs.doctype;
		const docname = frappe.get_route()[1];
		let dashboard_route = `/app/${frappe.router.slug(doctype)}/${docname}`;
		$(`<li><a href="${dashboard_route}">${__(docname)}</a></li>`).appendTo(this.$breadcrumbs);
	},

	setup_modules() {
		if (!frappe.visible_modules) {
			frappe.visible_modules = $.map(frappe.boot.allowed_workspaces, m => {
				return m.module;
			});
		}
	},

	rename(doctype, old_name, new_name) {
		var old_route_str = ["Form", doctype, old_name].join("/");
		var new_route_str = ["Form", doctype, new_name].join("/");
		this.all[new_route_str] = this.all[old_route_str];
		delete frappe.breadcrumbs.all[old_route_str];
		this.update();
	},

	clear() {
		this.$breadcrumbs = $("#navbar-breadcrumbs").empty();
		this.$modal_breadcrumbs = $("#navbar-route-history").empty();
	},

	toggle(show) {
		if (show) {
			$("body").addClass("no-breadcrumbs");
		} else {
			$("body").removeClass("no-breadcrumbs");
		}
	}
};
