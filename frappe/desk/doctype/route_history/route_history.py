# Copyright (c) 2022, Frappe Technologies and contributors
# License: MIT. See LICENSE

import frappe
from frappe.deferred_insert import deferred_insert as _deferred_insert
from frappe.model.document import Document


class RouteHistory(Document):
	@staticmethod
	def clear_old_logs(days=30):
		from frappe.query_builder import Interval
		from frappe.query_builder.functions import Now

		table = frappe.qb.DocType("Route History")
		frappe.db.delete(table, filters=(table.modified < (Now() - Interval(days=days))))


@frappe.whitelist()
def deferred_insert(routes):
	routes = [
		{
			"user": frappe.session.user,
			"route": route.get("route"),
			"creation": route.get("creation"),
		}
		for route in frappe.parse_json(routes)
	]

	_deferred_insert("Route History", routes)


@frappe.whitelist()
def frequently_visited_links():
	return frappe.get_all(
		"Route History",
		fields=["route", "count(name) as count"],
		filters={"user": frappe.session.user},
		group_by="route",
		order_by="count desc",
		limit=5,
	)


@frappe.whitelist()
def route_history(max_route: int = 10):
	route_history = frappe.get_list(
		'Route History',
		fields=['route'],
		filters={"user": frappe.session.user},
		order_by='creation desc',
		limit_page_length=max_route * 4)
	unique_routes = []
	for route_doc in route_history:
		if route_doc['route'] not in unique_routes:
			unique_routes.append(route_doc['route'])
	if '' in unique_routes:
		unique_routes.remove('')

	out = []
	doctypes = {}
	doctype_title_fields = {}
	for route_doc in unique_routes:
		path = route_doc.split('/')
		doc_info = {"view_name": path[0]}
		if len(path) > 1:
			doc_info["doctype"] = path[1]
		if len(path) == 3 and path[0] == 'Form':
			doc_info.update({
				"doc_name": path[2],
				"doc_title": None,
			})
			doctypes.setdefault(doc_info['doctype'], list())
			doctypes[doc_info['doctype']].append(doc_info['doc_name'])
		out.append(doc_info)

	doc_names_by_doctype = {}
	for doctype in doctypes:
		doctype_meta = frappe.get_meta(doctype)
		doctype_title_fields[doctype] = doctype_meta.title_field
		if not doctype_meta.issingle:
			for doc in frappe.get_list(
				doctype,
				fields=["name", doctype_title_fields[doctype]],
				filters={"name": ['in', doctypes[doctype]]},
				limit_page_length=50
			):
				doc_names_by_doctype[doctype] = {doc['name']: doc[doctype_title_fields[doctype]] if doctype_title_fields[doctype] in doc else None}
		else:
			doc_names_by_doctype[doctype] = {doctype_meta.name: ""}

	for i in range(len(out)):
		if 'doc_title' in out[i]:
			if out[i]['doctype'] in doc_names_by_doctype and len(doc_names_by_doctype[out[i]['doctype']]) > 0 and out[i]['doc_name'] in doc_names_by_doctype[out[i]['doctype']]:
				out[i]['doc_title'] = doc_names_by_doctype[out[i]['doctype']][out[i]['doc_name']]
	return out
