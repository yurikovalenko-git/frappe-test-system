frappe.provide("frappe.views");

frappe.views.GanttView = class GanttView extends frappe.views.ListView {
	get view_name() {
		return "Gantt";
	}

	setup_defaults() {
		return super.setup_defaults().then(() => {
			this.page_title = this.page_title + " " + __("Gantt");
			this.calendar_settings = frappe.views.calendar[this.doctype] || {};

			if (typeof this.calendar_settings.gantt == "object") {
				Object.assign(this.calendar_settings, this.calendar_settings.gantt);
			}

			if (this.calendar_settings.order_by) {
				this.sort_by = this.calendar_settings.field_map.start;
				this.sort_order = "asc";
			} else {
				this.sort_by = this.calendar_settings.field_map.start;
				this.sort_order = this.view_user_settings.sort_order || "asc";
			}
		});
	}

	setup_view() {}

	prepare_data(data) {
		super.prepare_data(data);
		this.prepare_tasks();
	}

	prepare_tasks() {
		var me = this;
		var meta = this.meta;
		var field_map = this.calendar_settings.field_map;

		this.tasks = this.data.map(function (item) {
			// set progress
			var progress = 0;
			if (field_map.progress && $.isFunction(field_map.progress)) {
				progress = field_map.progress(item);
			} else if (field_map.progress) {
				progress = item[field_map.progress];
			}

			// title
			var label;
			if (meta.title_field) {
				label = item.progress
					? __("{0} ({1}) - {2}%", [item[meta.title_field], item.name, item.progress])
					: __("{0} ({1})", [item[meta.title_field], item.name]);
			} else {
				label = item[field_map.title];
			}

			var r = {
				start: item[field_map.start],
				end: item[field_map.end],
				name: label,
				id: item[field_map.id || "name"],
				doctype: me.doctype,
				progress: progress,
				dependencies: item.depends_on_tasks || "",
				status: item.status,
				start_date: item.exp_start_date,
				end_date: item.exp_end_date,
				assign: item._assign ? JSON.parse(item._assign) : ['-'],
				is_group: item.is_group,
			};


			if (item.color && frappe.ui.color.validate_hex(item.color)) {
				r["custom_class"] = "color-" + item.color.substr(1);
			}

			if (item.is_milestone) {
				r["custom_class"] = "bar-milestone";
			}

			return r;
		});
	}

	render() {
		this.load_lib.then(() => {
			this.render_gantt();
		});
	}

	render_header() {}

	render_gantt() {
		const me = this;
		const gantt_view_mode = this.view_user_settings.gantt_view_mode || "Month";
		const field_map = this.calendar_settings.field_map;
		const date_format = "YYYY-MM-DD";

		this.$result.empty();
		this.$result.addClass("gantt-modern");

		this.gantt = new Gantt(this.$result[0], this.tasks, {
			bar_height: 35,
			bar_corner_radius: 4,
			resize_handle_width: 8,
			resize_handle_height: 28,
			resize_handle_corner_radius: 3,
			resize_handle_offset: 4,
			view_mode: gantt_view_mode,
			date_format: "YYYY-MM-DD",
			on_click: (task) => {
				frappe.set_route("Form", task.doctype, task.id);
			},
			on_date_change: (task, start, end) => {
				if (!me.can_write) return;
				frappe.db.set_value(task.doctype, task.id, {
					[field_map.start]: moment(start).format(date_format),
					[field_map.end]: moment(end).format(date_format),
				});
			},
			on_progress_change: (task, progress) => {
				if (!me.can_write) return;
				var progress_fieldname = "progress";

				if ($.isFunction(field_map.progress)) {
					progress_fieldname = null;
				} else if (field_map.progress) {
					progress_fieldname = field_map.progress;
				}

				if (progress_fieldname) {
					frappe.db.set_value(task.doctype, task.id, {
						[progress_fieldname]: parseInt(progress),
					});
				}
			},
			on_view_change: (mode) => {
				// save view mode
				me.save_view_user_settings({
					gantt_view_mode: mode,
				});
			},
			custom_popup_html: (task) => {
				var item = me.get_item(task.id);

				var html = `<div class="title">${task.name}</div>
					<div class="subtitle">${moment(task._start).format("MMM D")} - ${moment(task._end).format(
					"MMM D"
				)}</div>`;

				// custom html in doctype settings
				var custom = me.settings.gantt_custom_popup_html;
				if (custom && $.isFunction(custom)) {
					var ganttobj = task;
					html = custom(ganttobj, item);
				}
				return '<div class="details-container">' + html + "</div>";
			},
		});
		this.set_colors();
		this.setup_view_mode_buttons();
	}

	setup_view_mode_buttons() {
		// view modes (for translation) __("Day"), __("Week"), __("Month"),
		//__("Half Day"), __("Quarter Day")

		let $btn_group = this.$paging_area.find(".gantt-view-mode");
		if ($btn_group.length > 0) return;

		const view_modes = this.gantt.options.view_modes || [];
		const active_class = (view_mode) => (this.gantt.view_is(view_mode) ? "btn-info" : "");
		const html = `<div class="btn-group gantt-view-mode">
				${view_modes
					.map(
						(value) => `<button type="button"
						class="btn btn-default btn-sm btn-view-mode ${active_class(value)}"
						data-value="${value}">
						${__(value)}
					</button>`
					)
					.join("")}
			</div>`;

		const htmlTest = `<div class="gantt-table">
			<header class="level list-row-head text-muted">
				<div class="level-left list-header-subject">
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item">Subject</span>
					</div>
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item">Start date</span>
					</div>
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item">End date</span>
					</div>
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item">Status</span>
					</div>
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item">Assignee</span>
					</div>
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item">Dependencies</span>
					</div>
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item">Duration</span>
					</div>
				</div>
			</header>
			${this.tasks
			.map( (value) =>
			`<div class="list-row-container" tabindex="1">
				<div class="level list-row">
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item  ellipsis" title="test task 2">
							<a class="ellipsis" href="/app/task/${value.id}" title="test task 2" data-doctype="Task" data-name="test task 2">
								${value.name}
							</a>
						</span>
					</div>
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item  ellipsis" title="test task 2">
							<a class="ellipsis" href="/app/task/${value.id}" title="test task 2" data-doctype="Task" data-name="test task 2">
								${value.start_date}
							</a>
						</span>
					</div>
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item  ellipsis" title="test task 2">
							<a class="ellipsis" href="/app/task/${value.id}" title="test task 2" data-doctype="Task" data-name="test task 2">
								${value.end_date}
							</a>
						</span>
					</div>
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item  ellipsis" title="test task 2">
							<a class="ellipsis" href="/app/task/${value.id}" title="test task 2" data-doctype="Task" data-name="test task 2">
								${value.status}
							</a>
						</span>
					</div>
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item  ellipsis" title="test task 2">
							${value.assign
							.map( (assign) =>
							`<span class="avatar avatar-small  filterable" title="Administrator" data-filter="_assign,like,%Administrator%">
								<div class="avatar-frame standard-image" style="background-color: var(--dark-green-avatar-bg); color: var(--dark-green-avatar-color)">
									${assign.substring(0, 1)}
								</div>
							</span>
							`).join("")}
						</span>
					</div>
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item  ellipsis" title="test task 2">
							<a class="ellipsis" href="/app/task/${value.id}" title="test task 2" data-doctype="Task" data-name="test task 2">
								${value.dependencies}
							</a>
						</span>
					</div>
					<div class="list-row-col ellipsis list-subject level">
						<span class="level-item  ellipsis" title="test task 2">
							<a class="ellipsis" href="/app/task/${value.id}" title="test task 2" data-doctype="Task" data-name="test task 2">
								${Math.floor(Math.abs(new Date(value.end_date) - new Date(value.start_date)) / (3600000*24))} days
							</a>
						</span>
					</div>
				</div>
			</div>`).join("")}
		</div>`;


		this.$paging_area.find(".level-left").append(html);
		this.$frappe_list.find(".gantt-modern").append(htmlTest);
		console.log(this.tasks);

		// change view mode asynchronously
		const change_view_mode = (value) =>
			setTimeout(() => this.gantt.change_view_mode(value), 0);

		this.$paging_area.on("click", ".btn-view-mode", (e) => {
			const $btn = $(e.currentTarget);
			this.$paging_area.find(".btn-view-mode").removeClass("btn-info");
			$btn.addClass("btn-info");

			const value = $btn.data().value;
			change_view_mode(value);
		});
	}

	set_colors() {
		const classes = this.tasks
			.map((t) => t.custom_class)
			.filter((c) => c && c.startsWith("color-"));

		let style = classes
			.map((c) => {
				const class_name = c.replace("#", "");
				const bar_color = "#" + c.substr(6);
				const progress_color = frappe.ui.color.get_contrast_color(bar_color);
				return `
				.gantt .bar-wrapper.${class_name} .bar {
					fill: ${bar_color};
				}
				.gantt .bar-wrapper.${class_name} .bar-progress {
					fill: ${progress_color};
				}
			`;
			})
			.join("");

		style = `<style>${style}</style>`;
		this.$result.prepend(style);
		console.log('classes', classes);
	}

	get_item(name) {
		return this.data.find((item) => item.name === name);
	}

	get required_libs() {
		return [
			"assets/frappe/node_modules/frappe-gantt/dist/frappe-gantt.css",
			"assets/frappe/node_modules/frappe-gantt/dist/frappe-gantt.min.js",
		];
	}
};
