//#region src/model.ts
var e = {
	base: {
		min: .001,
		max: 150,
		step: .01
	},
	dmax: {
		min: .1,
		max: 6,
		step: .001
	},
	offset: {
		min: -1,
		max: 1,
		step: .001
	},
	low: {
		min: .25,
		max: 2,
		step: .001
	},
	high: {
		min: .25,
		max: 2,
		step: .001
	},
	black: {
		min: -50,
		max: 50,
		step: .01
	},
	grade: {
		min: 1,
		max: 8,
		step: .01
	},
	gloss: {
		min: .01,
		max: 100,
		step: .01
	},
	exposure: {
		min: -1,
		max: 1,
		step: .001
	}
}, t = {
	base: [
		113,
		49,
		27
	],
	dmax: 1.6,
	offset: -.05,
	low: [
		1,
		1,
		1
	],
	high: [
		1,
		1,
		1
	],
	black: 7.55,
	grade: 4,
	gloss: 75,
	exposure: Math.log2(.9245)
}, n = {
	base: [
		100,
		100,
		100
	],
	dmax: 2.2,
	offset: -.05,
	low: [
		1,
		1,
		1
	],
	high: [
		1,
		1,
		1
	],
	black: 7.55,
	grade: 5,
	gloss: 75,
	exposure: 0
}, r = {
	stock: "off",
	...t
}, i = (e) => e === "bw" ? n : t, a = 23283064365386963e-26, o = [
	.2126,
	.7152,
	.0722
], s = (e, t) => Math.min(t.max, Math.max(t.min, e)), c = (e, t, n) => Number.isFinite(e) ? s(e, n) : t, l = (e, t, n) => [
	c(e[0], t[0], n),
	c(e[1], t[1], n),
	c(e[2], t[2], n)
], u = (e) => [
	e(0),
	e(1),
	e(2)
];
function d(e, t) {
	if (e !== "bw") return t;
	let n = o[0] * t[0] + o[1] * t[1] + o[2] * t[2];
	return [
		n,
		n,
		n
	];
}
var f = (e) => u((t) => (e.stock === "bw" ? e.base[0] : e.base[t]) / 100), p = (e, t) => {
	let n = f(e);
	return u((e) => Math.log10(n[e] / Math.max(t[e], a)));
}, m = (t, n) => ({ base: l(n.map((e) => e * 100), t.base, e.base) }), h = (t, n) => ({ dmax: c(Math.max(...p(t, n)), t.dmax, e.dmax) }), g = (t, n) => ({ offset: c(Math.min(...p(t, n)) / t.dmax, t.offset, e.offset) });
function _(t, n) {
	let r = p(t, n).map((e) => e / t.dmax), i = Math.min(...r);
	return { low: l(r.map((e) => i / e), t.low, e.low) };
}
function ee(t, n) {
	let r = p(t, n), i = u((e) => Math.abs(-1 / (t.offset * t.low[e] - r[e] / t.dmax))), a = Math.min(...i);
	return { high: l(i.map((e) => e / a), t.high, e.high) };
}
function v(t, n) {
	let r = p(t, n), i = u((e) => .1 - (1 - 10 ** (-r[e] * t.high[e] / t.dmax + t.low[e] * t.offset * t.high[e])));
	return { black: c(Math.max(...i) * 100, t.black, e.black) };
}
function y(t, n) {
	let r = p(t, n), i = t.black / 100, a = u((e) => .96 / (1 - 10 ** (-r[e] * t.high[e] / t.dmax + t.low[e] * t.offset) + i));
	return { exposure: c(Math.log2(Math.max(Math.min(...a), 2 ** e.exposure.min)), t.exposure, e.exposure) };
}
function te(t, n) {
	let r = p(t, n.thin).map((e) => e / t.dmax), i = p(t, n.dense).map((e) => e / t.dmax), a = r.map((e, t) => i[t] - e);
	if (a.some((e) => !(e > 0)) || !(t.offset > 0)) return null;
	let o = Math.max(...a), s = a.map((e) => o / e), c = s.map((e, t) => e * r[t]), u = c.indexOf(Math.min(...c)), d = s[u] * t.offset - c[u], f = s.map((e, n) => (d + c[n]) / (e * t.offset));
	return {
		high: l(s, t.high, e.high),
		low: l(f, t.low, e.low)
	};
}
function ne(e, t) {
	let n = {
		...e,
		stock: e.stock === "off" ? "colour" : e.stock
	};
	t.base && (n = {
		...n,
		...m(n, t.base)
	}), n = {
		...n,
		...h(n, t.dense)
	}, n = {
		...n,
		...g(n, t.thin)
	};
	let r = te(n, t);
	return r ? n = {
		...n,
		...r
	} : (n = {
		...n,
		..._(n, t.thin)
	}, n = {
		...n,
		...ee(n, t.dense)
	}), n = {
		...n,
		...v(n, t.thin)
	}, {
		...n,
		...y(n, t.dense)
	};
}
var re = (e) => {
	let t = i(e.stock).base;
	return e.base.every((e, n) => e === t[n]);
}, b = "film-negative", x = `${b}.invert`, S = (e) => `${x}.${e}`, C = {
	off: 0,
	colour: 1,
	bw: 2
}, ie = [
	"off",
	"colour",
	"bw"
], ae = [
	"base",
	"low",
	"high"
], oe = [
	"dmax",
	"offset",
	"black",
	"grade",
	"gloss",
	"exposure"
], se = 3, ce = { [S("stock")]: se }, w = (e) => typeof e == "number" && Number.isFinite(e);
function T(t, n) {
	let i = t[S(n)];
	return w(i) ? s(i, e[n]) : r[n];
}
function E(t, n) {
	let i = t[S(n)];
	if (!Array.isArray(i) || i.length !== 3 || !i.every(w)) return r[n];
	let a = e[n];
	return [
		s(i[0], a),
		s(i[1], a),
		s(i[2], a)
	];
}
function le(e) {
	let t = e[S("stock")];
	return ie.find((e) => C[e] === t) ?? r.stock;
}
function D(e) {
	return {
		stock: le(e),
		base: E(e, "base"),
		dmax: T(e, "dmax"),
		offset: T(e, "offset"),
		low: E(e, "low"),
		high: E(e, "high"),
		black: T(e, "black"),
		grade: T(e, "grade"),
		gloss: T(e, "gloss"),
		exposure: T(e, "exposure")
	};
}
function O(e) {
	let t = {};
	e.stock !== void 0 && (t[S("stock")] = C[e.stock]);
	for (let n of ae) {
		let r = e[n];
		r !== void 0 && (t[S(n)] = [...r]);
	}
	for (let n of oe) {
		let r = e[n];
		r !== void 0 && (t[S(n)] = r);
	}
	return t;
}
//#endregion
//#region src/metering.ts
var ue = .01, de = .1, fe = .999, pe = .005, me = .995, k = (e) => e.width < 2 && e.height < 2, A = (e, t, n, r) => {
	let i = 4 * (n * e.width + t);
	return d(r, [
		e.data[i],
		e.data[i + 1],
		e.data[i + 2]
	]);
}, j = (e, t) => Math.min(e.width - 1, Math.max(0, Math.floor(t * e.width))), M = (e, t) => Math.min(e.height - 1, Math.max(0, Math.floor(t * e.height)));
function he(e, t) {
	if ("x0" in t) return {
		x0: j(e, Math.min(t.x0, t.x1)),
		y0: M(e, Math.min(t.y0, t.y1)),
		x1: j(e, Math.max(t.x0, t.x1)),
		y1: M(e, Math.max(t.y0, t.y1))
	};
	let n = Math.max(2, Math.floor(ue * Math.max(e.width, e.height))), r = j(e, t.x), i = M(e, t.y);
	return {
		x0: Math.max(0, r - n),
		y0: Math.max(0, i - n),
		x1: Math.min(e.width - 1, r + n),
		y1: Math.min(e.height - 1, i + n)
	};
}
var ge = (e) => "x0" in e ? Math.max(e.x0, e.x1) < 0 || Math.min(e.x0, e.x1) > 1 || Math.max(e.y0, e.y1) < 0 || Math.min(e.y0, e.y1) > 1 : e.x < 0 || e.x > 1 || e.y < 0 || e.y > 1;
function _e(e, t, n) {
	if (k(e) || ge(t)) return null;
	let r = he(e, t), i = [
		0,
		0,
		0
	], a = [
		Infinity,
		Infinity,
		Infinity
	], o = [
		-Infinity,
		-Infinity,
		-Infinity
	], s = 0;
	for (let t = r.y0; t <= r.y1; t++) for (let c = r.x0; c <= r.x1; c++) {
		let r = A(e, c, t, n);
		for (let e = 0; e < 3; e++) i[e] += r[e], a[e] = Math.min(a[e], r[e]), o[e] = Math.max(o[e], r[e]);
		s++;
	}
	return {
		mean: [
			i[0] / s,
			i[1] / s,
			i[2] / s
		],
		min: [
			a[0],
			a[1],
			a[2]
		],
		max: [
			o[0],
			o[1],
			o[2]
		]
	};
}
function N(e, t) {
	let n = (e) => e[Math.min(e.length - 1, Math.max(0, Math.round(t * (e.length - 1))))];
	return [
		n(e[0]),
		n(e[1]),
		n(e[2])
	];
}
function P(e, t, n) {
	let r = Math.floor(n * e.width), i = Math.floor(n * e.height), a = Math.max(r + 1, e.width - r), o = Math.max(i + 1, e.height - i), s = [
		0,
		1,
		2
	].map(() => new Float32Array((a - r) * (o - i))), c = 0;
	for (let n = i; n < o; n++) for (let i = r; i < a; i++, c++) {
		let r = A(e, i, n, t);
		s[0][c] = r[0], s[1][c] = r[1], s[2][c] = r[2];
	}
	for (let e of s) e.sort();
	return s;
}
function ve(e, t) {
	if (k(e)) return null;
	let n = P(e, t, de);
	return {
		base: N(P(e, t, 0), fe),
		dense: N(n, pe),
		thin: N(n, me)
	};
}
//#endregion
//#region src/rt.ts
var F, I;
function ye(e) {
	I = e, F = e.react;
}
//#endregion
//#region src/measure.ts
var L = {
	base: {
		name: "Film base",
		over: "bare film, such as the rebate between frames",
		reads: "mean",
		apply: m
	},
	dmax: {
		name: "D max",
		over: "the densest part of the film",
		reads: "min",
		apply: h
	},
	offset: {
		name: "Scan bias",
		over: "the thinnest part of the film",
		reads: "max",
		apply: g
	},
	low: {
		name: "Shadows colour",
		over: "something that should print neutral black",
		reads: "mean",
		apply: _
	},
	high: {
		name: "Highlights white balance",
		over: "something that should print neutral white",
		reads: "mean",
		apply: ee
	},
	black: {
		name: "Paper black",
		over: "the thinnest part of the picture",
		reads: "max",
		apply: v
	},
	exposure: {
		name: "Print exposure",
		over: "the densest part of the picture",
		reads: "min",
		apply: y
	}
}, R = {
	point: "decode",
	space: {
		encoding: "linear",
		primaries: "rec709"
	},
	paramBag: { ...ce }
}, be = 1024, xe = "No photo is open.", z = "Couldn't read the photo: this graphics card has no float render targets.", B = "The photo changed before the reading finished.", Se = "That was off the image.", V = class extends Error {}, H = () => I.stores.useDevelopStore.getState();
function U() {
	let e = H();
	if (!e.photoId) throw new V(xe);
	return {
		photoId: e.photoId,
		negative: D(e.paramBag)
	};
}
function W(e, t) {
	if (H().photoId !== e.photoId) throw new V(B);
	if (!t) throw new V(z);
	return t;
}
function G(e, t, n) {
	if (H().photoId !== e.photoId) throw new V(B);
	H().setDynParams(O(t)), H().commitEdit(`Film Negative ${n}`);
}
async function K(e) {
	try {
		return await e();
	} catch (e) {
		return e instanceof V ? {
			kind: "failed",
			reason: e.message
		} : (console.warn("[film-negative] reading failed:", e), {
			kind: "failed",
			reason: "The reading failed; see the console."
		});
	}
}
function Ce(e, t) {
	return K(async () => {
		let n = U(), r = H(), i = _e(W(n, await I.develop.captureFloatFrame(r.previewParams ?? r.params, {
			...R,
			maxEdge: be
		})), t, n.negative.stock);
		if (!i) throw new V(Se);
		let a = L[e];
		return G(n, a.apply(n.negative, i[a.reads]), a.name.toLowerCase()), {
			kind: "done",
			status: `${a.name} set.`
		};
	});
}
function we() {
	return K(async () => {
		let e = U(), t = H(), n = e.negative.stock === "off" ? "colour" : e.negative.stock, r = ve(W(e, await I.develop.renderPhotoFloatFrame(e.photoId, t.previewParams ?? t.params, R)), n);
		if (!r) throw new V(z);
		let i = {
			...e.negative,
			stock: n
		}, a = re(i);
		return G(e, ne(i, {
			dense: r.dense,
			thin: r.thin,
			...a ? { base: r.base } : {}
		}), "auto"), {
			kind: "done",
			status: a ? "Fitted, with the film base read from the frame." : "Fitted to the film base set."
		};
	});
}
//#endregion
//#region src/Panel.tsx
var q = [
	{
		value: "off",
		label: "Off"
	},
	{
		value: "colour",
		label: "Colour"
	},
	{
		value: "bw",
		label: "B&W"
	}
], Te = [
	"Red",
	"Green",
	"Blue"
], J = {
	dmax: "D max",
	offset: "Scan bias",
	black: "Paper black",
	grade: "Paper grade",
	gloss: "Paper gloss",
	exposure: "Print exposure"
}, Ee = (e) => `Film Negative ${e.toLowerCase()}`, De = (e, t, n) => [
	t === 0 ? n : e[0],
	t === 1 ? n : e[1],
	t === 2 ? n : e[2]
];
function Oe() {
	let e = I.develop.useParamScope(), { AutoButton: t } = I.components, { SegmentedControl: n, Stack: r, tokens: a } = I.ui, o = I.stores.useDevelopStore((e) => e.photoId !== null), s = D(e.getParams()), [c, l] = F.useState(""), [u, d] = F.useState(null), f = I.develop.useCanvasToolHeld();
	F.useEffect(() => {
		f || d(null);
	}, [f]);
	let p = F.useCallback((e) => l(e.kind === "done" ? e.status : e.reason), []), m = (t) => {
		if (t === s.stock) return;
		let n = s.stock === "off" && t !== "off" ? {
			...i(t),
			stock: t
		} : { stock: t };
		e.setParams(O(n)), e.commit("Film Negative film type");
	}, h = (e) => {
		u === e ? (je(), d(null), l("")) : (d(e), l(`${L[e].name}: drag over ${L[e].over}, or click it. Esc cancels.`), Ae((t) => {
			d(null), l("Reading…"), Ce(e, t).then(p);
		}, () => {
			d(null), l("");
		}));
	}, g = () => {
		l("Reading…"), we().then(p);
	};
	return /* @__PURE__ */ F.createElement("div", { style: { padding: 8 } }, /* @__PURE__ */ F.createElement(r, { gap: 6 }, /* @__PURE__ */ F.createElement(n, {
		size: "sm",
		value: s.stock,
		options: [...q],
		onChange: (e) => m(q.find((t) => t.value === e)?.value ?? "off")
	}), /* @__PURE__ */ F.createElement(t, {
		title: "Auto: fit the film and the print to this photo",
		disabled: !o,
		onClick: g
	})), s.stock !== "off" && /* @__PURE__ */ F.createElement(ke, {
		scope: e,
		n: s,
		armed: u,
		arm: h
	}), /* @__PURE__ */ F.createElement("div", {
		role: "status",
		"aria-live": "polite",
		style: {
			color: a.textMuted,
			fontSize: 11,
			minHeight: 14,
			marginTop: 4
		}
	}, c));
}
function ke({ scope: t, n, armed: r, arm: a }) {
	let { Slider: o } = I.components, { Button: s, Row: c, Section: l } = I.ui, u = i(n.stock), d = n.stock === "bw", f = (e, t = "Pick") => /* @__PURE__ */ F.createElement(s, {
		key: e,
		size: "sm",
		active: r === e,
		"aria-pressed": r === e,
		title: `Pick ${L[e].name}: ${L[e].over} (Esc cancels)`,
		onClick: () => a(e)
	}, t), p = (e, n, r, i, a, s) => /* @__PURE__ */ F.createElement(o, {
		key: e,
		label: e,
		value: n,
		min: r.min,
		max: r.max,
		step: r.step,
		defaultValue: i,
		onChange: (e) => t.setParams(O(a(e))),
		onCommit: () => t.commit(Ee(s))
	}), m = (t) => p(J[t], n[t], e[t], u[t], (e) => ({ [t]: e }), J[t]), h = (t, r) => Te.map((i, a) => p(i, n[t][a], e[t], u[t][a], (e) => ({ [t]: De(n[t], a, e) }), r));
	return /* @__PURE__ */ F.createElement(F.Fragment, null, /* @__PURE__ */ F.createElement(l, {
		title: "Film base",
		right: f("base")
	}, d ? p("Density", n.base[0], e.base, u.base[0], (e) => ({ base: [
		e,
		e,
		e
	] }), "Film base") : h("base", "Film base")), /* @__PURE__ */ F.createElement(l, { title: "Film" }, m("dmax"), m("offset"), /* @__PURE__ */ F.createElement(c, { gap: 6 }, f("dmax", "Pick D max"), f("offset", "Pick Scan bias"))), !d && /* @__PURE__ */ F.createElement(F.Fragment, null, /* @__PURE__ */ F.createElement(l, {
		title: "Shadows colour",
		right: f("low")
	}, h("low", "Shadows colour")), /* @__PURE__ */ F.createElement(l, {
		title: "Highlights white balance",
		right: f("high")
	}, h("high", "Highlights white balance"))), /* @__PURE__ */ F.createElement(l, { title: "Print" }, m("black"), m("grade"), m("gloss"), m("exposure"), /* @__PURE__ */ F.createElement(c, { gap: 6 }, f("black", "Pick Paper black"), f("exposure", "Pick Print exposure"))));
}
var Y = null;
function Ae(e, t) {
	Y?.cancel(), Y = {
		pick: e,
		cancel: t
	}, I.develop.setCanvasTool({
		overlay: Ne,
		onEscape: () => {
			Y?.cancel(), Y = null;
		}
	});
}
function je() {
	Y = null, I.develop.setCanvasTool(null);
}
var Me = 4;
function Ne({ rect: e }) {
	let { tokens: t } = I.ui, [n, r] = F.useState(null), i = (t) => {
		let n = t.currentTarget, r = n.getBoundingClientRect(), i = (t.clientX - r.left) / r.width * n.offsetWidth, a = (t.clientY - r.top) / r.height * n.offsetHeight;
		return {
			x: (i - e.x) / e.w,
			y: (a - e.y) / e.h
		};
	}, a = (e) => {
		if (!n) return;
		let t = i(e), a = Math.hypot(e.clientX - n.startX, e.clientY - n.startY) >= Me ? {
			x0: n.from.x,
			y0: n.from.y,
			x1: t.x,
			y1: t.y
		} : n.from;
		r(null);
		let o = Y;
		Y = null, I.develop.setCanvasTool(null), o?.pick(a);
	}, o = n && {
		left: e.x + Math.min(n.from.x, n.to.x) * e.w,
		top: e.y + Math.min(n.from.y, n.to.y) * e.h,
		width: Math.abs(n.to.x - n.from.x) * e.w,
		height: Math.abs(n.to.y - n.from.y) * e.h
	};
	return /* @__PURE__ */ F.createElement("div", {
		"data-testid": "area-surface",
		style: {
			position: "absolute",
			inset: 0,
			cursor: "crosshair",
			pointerEvents: "auto"
		},
		onPointerDown: (e) => {
			if (e.button !== 0) return;
			e.currentTarget.setPointerCapture?.(e.pointerId);
			let t = i(e);
			r({
				from: t,
				to: t,
				startX: e.clientX,
				startY: e.clientY
			});
		},
		onPointerMove: (e) => n && r({
			...n,
			to: i(e)
		}),
		onPointerUp: a
	}, o && /* @__PURE__ */ F.createElement("div", { style: {
		position: "absolute",
		...o,
		border: `1px solid ${t.accent}`,
		pointerEvents: "none"
	} }));
}
//#endregion
//#region src/stage.ts
var Pe = "\nif (stock == 1 || stock == 2) {\n  vec3 fnIn = stock == 2 ? vec3(dot(lin, vec3(0.2126, 0.7152, 0.0722))) : lin;\n  vec3 fnBase = (stock == 2 ? vec3(base.r) : base) / 100.0;\n  vec3 fnDensity = log2(max(fnIn, vec3(2.3283064365386963e-10)) / fnBase) * 0.30102999566398120;\n  vec3 fnCorrected = high / dmax * fnDensity + high * offset * low;\n  vec3 fnPrint = pow(max(exp2(exposure) * (1.0 + black / 100.0 - exp2(fnCorrected * 3.32192809488736235)), vec3(0.0)), vec3(grade));\n  float fnGloss = gloss / 100.0;\n  float fnRoll = max(1.0 - fnGloss, 1e-6);\n  vec3 fnSoft = fnGloss + (1.0 - exp(-(fnPrint - fnGloss) / fnRoll)) * fnRoll;\n  lin = mix(fnPrint, fnSoft, greaterThan(fnPrint, vec3(fnGloss)));\n}", X = r, Z = (t, n, r) => ({
	key: t,
	glslType: "float",
	default: r,
	range: e[t],
	label: n
}), Q = (e, t) => ({
	key: e,
	glslType: "vec3",
	default: [...X[e]],
	label: t
});
function Fe() {
	return {
		id: x,
		name: "Film Negative",
		phase: "decode",
		priority: 900,
		glsl: Pe.trimStart(),
		uniforms: [
			{
				key: "stock",
				glslType: "int",
				default: 0,
				label: "Film type"
			},
			Q("base", "Film base"),
			Z("dmax", "D max", X.dmax),
			Z("offset", "Scan bias", X.offset),
			Q("low", "Shadows colour"),
			Q("high", "Highlights white balance"),
			Z("black", "Paper black", X.black),
			Z("grade", "Paper grade", X.grade),
			Z("gloss", "Paper gloss", X.gloss),
			Z("exposure", "Print exposure", X.exposure)
		],
		dormantWhen: { stock: 0 },
		plainSource: !0
	};
}
//#endregion
//#region src/index.tsx
var $ = `${b}.panel`;
function Ie(e) {
	ye(e), e.registerProcessingStage(Fe()), e.registerPanel({
		id: $,
		title: "Film Negative",
		component: Oe,
		defaultDock: {
			module: "develop",
			direction: "right",
			width: 280
		},
		onReset: () => {
			let t = e.stores.useDevelopStore.getState();
			t.setDynParams(O(r)), t.commitEdit("Film Negative reset");
		}
	});
}
//#endregion
export { $ as PANEL_ID, Ie as activate };

//# sourceMappingURL=index.js.map