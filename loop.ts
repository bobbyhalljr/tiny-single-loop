// tiny-single-loop: one agent, one context, skills and tools loaded on demand.
// Small model of the pattern Anthropic describes, not Claude's implementation.
// Fake model, fake tools, rough token estimate (chars / 4). No API key. No network.

type Skill = { name: string; description: string; body: string };
type Tool = { name: string; description: string; schema: string; write: boolean; run: (a: string) => string };

// Step 1: a catalog with two levels of detail
const skills: Skill[] = [
  { name: "refunds", description: "Refund or partially refund a customer order.",
    body: "Refund policy: full refund within 30 days. After 30 days, store credit only. ".repeat(12) +
      "Steps: look up the order, check the date, then issue_refund or issue_credit." },
  { name: "shipping", description: "Track, reroute, or reship a package.",
    body: "Carrier rules, address change cutoffs, reship limits. ".repeat(20) },
  { name: "billing", description: "Explain charges, invoices, and failed payments.",
    body: "Invoice formats, proration rules, retry schedules. ".repeat(20) },
];
const tools: Tool[] = [
  { name: "lookup_order", description: "Get an order by id.", schema: "{ id: string }".padEnd(240), write: false,
    run: (id) => `order ${id}: $48.00, placed 12 days ago` },
  { name: "issue_refund", description: "Refund an order to the original payment.", schema: "{ id: string, amount: number }".padEnd(240), write: true,
    run: (id) => `refunded order ${id}` },
  { name: "issue_credit", description: "Give store credit.", schema: "{ id: string, amount: number }".padEnd(240), write: true,
    run: (id) => `credited order ${id}` },
  { name: "track_package", description: "Carrier tracking.", schema: "{ id: string }".padEnd(240), write: false, run: () => "" },
  { name: "reroute_package", description: "Change delivery address.", schema: "{ id: string, address: string }".padEnd(240), write: true, run: () => "" },
];
const tok = (s: string) => Math.ceil(s.length / 4);

// Step 2: what the model sees up front
function upfront(): string {
  return skills.map((s) => `skill ${s.name}: ${s.description}`).join("\n") +
    "\ntools: load_skill(name), tool_search(query)";
}
function everything(): string {
  return skills.map((s) => s.body).join("\n") + tools.map((t) => t.schema).join("\n");
}

// Step 3: the two loader tools
type Ctx = { text: string; loaded: Set<string>; visible: Set<string>; log: string[] };
function loadSkill(c: Ctx, name: string) {
  const s = skills.find((x) => x.name === name);
  if (!s || c.loaded.has(name)) return;
  c.loaded.add(name);
  c.text += "\n" + s.body;
  c.log.push(`load_skill(${name})  +${tok(s.body)} tok`);
}
function toolSearch(c: Ctx, query: string) {
  const hits = tools.filter((t) => query.split(" ").some((w) => t.name.includes(w)));
  for (const t of hits) { c.visible.add(t.name); c.text += "\n" + t.schema; }
  c.log.push(`tool_search("${query}")  -> ${hits.map((t) => t.name).join(", ")}  +${hits.length * tok(hits[0]?.schema ?? "")} tok`);
}

// Step 4: one loop, with limits in the harness
type Limits = { maxTurns: number; approvedWrites: Set<string> };
function call(c: Ctx, lim: Limits, name: string, arg: string): string {
  const t = tools.find((x) => x.name === name);
  if (!t || !c.visible.has(name)) return `ERROR ${name} not loaded`;
  if (t.write && !lim.approvedWrites.has(name)) return `GATE ${name} needs approval`;
  return t.run(arg);
}
// A fake model: a plan of steps it would choose, one batch per turn.
const plan: Array<(c: Ctx, lim: Limits) => string | null> = [
  (c) => { loadSkill(c, "refunds"); return null; },
  (c) => { toolSearch(c, "order refund credit"); return null; },
  (c, l) => call(c, l, "lookup_order", "1042"),
  (c, l) => call(c, l, "issue_refund", "1042"),
];
function run(task: string, lim: Limits) {
  const c: Ctx = { text: upfront() + "\n" + task, loaded: new Set(), visible: new Set(), log: [] };
  let turn = 0;
  for (const step of plan) {
    if (++turn > lim.maxTurns) { c.log.push("STOP turn budget"); break; }
    const out = step(c, lim);
    if (out) c.log.push(out);
    if (out?.startsWith("GATE")) break;
  }
  return { c, turn };
}

// Step 5: run it
console.log("tiny-single-loop demo (fake model, fake tools)\n");
console.log(`all skills + tools up front:  ~${tok(everything())} tok`);
console.log(`names + descriptions only:    ~${tok(upfront())} tok\n`);
const task = "Customer wants a refund for order 1042.";
for (const [label, lim] of [
  ["run 1 (no write approval)", { maxTurns: 6, approvedWrites: new Set<string>() }],
  ["run 2 (refund approved)", { maxTurns: 6, approvedWrites: new Set(["issue_refund"]) }],
  ["run 3 (turn budget 2)", { maxTurns: 2, approvedWrites: new Set(["issue_refund"]) }],
] as const) {
  const { c } = run(task, lim);
  console.log(label);
  for (const l of c.log) console.log("  " + l);
  console.log(`  context at end: ~${tok(c.text)} tok, skills loaded: ${[...c.loaded].join(", ") || "none"}\n`);
}
