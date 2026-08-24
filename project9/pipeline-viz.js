(function () {
  const PROGRAMS = [
    { id: "fwd_chain", label: "Forwarding chain (MX/WX)" },
    { id: "load_use_hazard", label: "Load-use hazard (stall)" },
    { id: "branch_cmp", label: "Branch taken (flush)" },
    { id: "jal_fwd_hazard", label: "JAL forwarding" },
    { id: "store_load", label: "Store-load (WM forward)" },
  ];

  const SEQ_COLORS = [
    "#e06c75", "#61afef", "#98c379", "#e5c07b",
    "#c678dd", "#56b6c2", "#d19a66", "#528bff",
  ];

  function colorForSeq(seq) {
    return SEQ_COLORS[seq % SEQ_COLORS.length];
  }

  const state = {
    program: null,
    trace: null,
    idx: 0,
    playing: false,
    timer: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  // IF tells us how many real instructions a program has: once it's run
  // past the end, it reads 0x00000000 from unwritten IMEM (not a valid
  // RV32I encoding, so this can't be a real instruction).
  function getMaxRealSeq(trace) {
    for (const c of trace) {
      if (!c.if.is_bubble && c.if.inst_raw === "0x00000000") {
        return c.if.seq - 1;
      }
    }
    return Infinity;
  }

  // Static per-program reference: every real (non-bubble) instruction, in
  // fetch order, colored the same way the diagram colors it -- built once
  // per scenario load, not per cycle, since the program itself doesn't change.
  // Each entry is highlighted live in render() whenever that instruction is
  // actually somewhere in the pipeline this cycle.
  let legendChips = new Map(); // seq -> element
  function buildProgramLegend(trace, maxRealSeq) {
    const D = window.RiscvDisasm.disassemble;

    // The very first instruction is primed straight into ID by reset before
    // the trace even starts recording (see tb_cpu_trace.v's seq/bubble
    // tracking), so it never actually appears in c.if -- scan every stage,
    // not just IF, so seq 1 isn't silently dropped.
    const seen = new Map();
    for (const c of trace) {
      for (const stage of [c.if, c.id, c.ex, c.m, c.wb]) {
        if (stage.is_bubble || stage.seq > maxRealSeq || seen.has(stage.seq)) continue;
        seen.set(stage.seq, D(stage.inst_raw !== undefined ? stage.inst_raw : stage.inst));
      }
    }
    const entries = Array.from(seen.entries()).sort((a, b) => a[0] - b[0]);
    $("pv-program-legend").innerHTML = entries
      .map(
        ([seq, mnem]) =>
          `<span class="pv-legend-chip" data-seq="${seq}" style="color:${colorForSeq(seq)}"><span class="pv-legend-num">${seq}</span>${mnem}</span>`
      )
      .join("");
    legendChips = new Map(
      Array.from($("pv-program-legend").querySelectorAll(".pv-legend-chip")).map((el) => [
        Number(el.dataset.seq),
        el,
      ])
    );
  }

  async function loadProgram(name) {
    const res = await fetch(`project9/data/${name}.trace.json`);
    let trace = await res.json();

    // Trim off the tail of pure bubble/nop cycles: once the last real
    // instruction has finished writeback, everything after is just the
    // drained pipeline reading empty memory -- nothing left to step through.
    const maxRealSeq = getMaxRealSeq(trace);
    if (maxRealSeq !== Infinity) {
      const lastRealWbIdx = trace.findIndex((c) => !c.wb.is_bubble && c.wb.seq === maxRealSeq);
      if (lastRealWbIdx !== -1) trace = trace.slice(0, lastRealWbIdx + 1);
    }

    state.program = name;
    state.trace = trace;
    state.maxRealSeq = maxRealSeq;
    state.idx = 0;
    stopPlaying();
    $("pv-scrubber").max = trace.length - 1;
    buildProgramLegend(trace, maxRealSeq);
    render();
  }

  function stepTo(idx) {
    if (!state.trace) return;
    state.idx = Math.max(0, Math.min(state.trace.length - 1, idx));
    render();
  }

  function stepForward() {
    stepTo(state.idx + 1);
  }
  function stepBack() {
    stepTo(state.idx - 1);
  }

  function togglePlay() {
    if (state.playing) {
      stopPlaying();
    } else {
      state.playing = true;
      $("pv-play").textContent = "Pause";
      state.timer = setInterval(() => {
        if (state.idx >= state.trace.length - 1) {
          stopPlaying();
          return;
        }
        stepForward();
      }, 700);
    }
  }
  function stopPlaying() {
    state.playing = false;
    clearInterval(state.timer);
    if ($("pv-play")) $("pv-play").textContent = "Play";
  }

  function hex(v) {
    return v; // already formatted "0x........" by the trace
  }

  function setCard(stageEl, seq, isBubble, mnemonic) {
    stageEl.textContent = isBubble ? "bubble" : mnemonic;
    stageEl.classList.toggle("pv-bubble", isBubble);
    stageEl.style.color = isBubble ? "" : colorForSeq(seq);
  }

  // wires tagged data-stage="if"/"id"/"ex"/"m"/"wb" carry that stage's
  // current instruction -- recolor them each cycle so the color reads on
  // the path itself, cached once since the tagged set never changes.
  const stageWires = {};
  function cacheStageWires() {
    ["if", "id", "ex", "m", "wb"].forEach((s) => {
      stageWires[s] = Array.from(document.querySelectorAll(`.pv-wire[data-stage="${s}"]`));
    });
    stageWires["pc-redirect"] = Array.from(document.querySelectorAll('.pv-wire[data-role="pc-redirect"]'));
    stageWires["wb-feedback"] = Array.from(document.querySelectorAll('.pv-wire[data-role="wb-feedback"]'));
  }

  function paintStageWires(stage, seq, isBubble) {
    const color = isBubble ? "" : colorForSeq(seq);
    for (const wire of stageWires[stage]) {
      wire.style.stroke = color;
      wire.classList.toggle("pv-wire-bubble", isBubble);
    }
  }

  function paintRoleWires(role, active, color) {
    for (const wire of stageWires[role]) {
      wire.style.stroke = active ? color : "";
      wire.style.opacity = active ? "0.9" : "";
    }
  }

  function setHi(id, on) {
    const el = $(id);
    if (el) el.classList.toggle("pv-active", !!on);
  }

  function annotate(c) {
    const notes = [];
    if (c.stall) notes.push("Load-use hazard: PC/IF-ID frozen, bubble inserted into EX.");
    if (c.ex.flush) notes.push("Branch/jump resolved in EX: flushing wrong-path instruction(s), redirecting PC.");
    const fA = c.ex.fwdA, fB = c.ex.fwdB;
    if (fA === 2) notes.push("MX forward: EX operand A ← M-stage ALU result.");
    if (fA === 3) notes.push("WX forward: EX operand A ← WB-stage result.");
    if (fB === 2) notes.push("MX forward: EX operand B ← M-stage ALU result.");
    if (fB === 3) notes.push("WX forward: EX operand B ← WB-stage result.");
    if (c.ex.fwdM) notes.push("WM forward: M-stage store data ← WB-stage result.");
    if (c.ex.fwdrs2EXreg) notes.push("rs2 forwarded into EX/M register for an upcoming store.");
    if (!notes.length) notes.push("No hazard this cycle.");
    return notes.join(" ");
  }

  function render() {
    const trace = state.trace;
    if (!trace) return;
    const c = trace[state.idx];
    const D = window.RiscvDisasm.disassemble;

    $("pv-cycle-label").textContent = `Cycle ${c.cycle} / ${trace.length - 1}`;
    $("pv-scrubber").value = state.idx;

    // A stage can be non-bubble but still empty: once IF has run past the
    // last real instruction it reads 0x00000000 from unwritten IMEM, and
    // that "instruction" rides down the pipeline for a few cycles with
    // is_bubble=0 (it was never a stall/flush-injected bubble) even though
    // it isn't real. Treat anything past the program's last real seq the
    // same as a bubble everywhere the diagram decides what to color/light up.
    const maxSeq = state.maxRealSeq;
    const isEmpty = (stage) => stage.is_bubble || stage.seq > maxSeq;

    const activeSeqs = new Set();
    for (const stage of [c.if, c.id, c.ex, c.m, c.wb]) {
      if (!isEmpty(stage)) activeSeqs.add(stage.seq);
    }
    for (const [seq, el] of legendChips) {
      el.classList.toggle("pv-legend-active", activeSeqs.has(seq));
    }

    setCard($("pv-if-card"), c.if.seq, isEmpty(c.if), D(c.if.inst_raw));
    setCard($("pv-id-card"), c.id.seq, isEmpty(c.id), D(c.id.inst));
    setCard($("pv-ex-card"), c.ex.seq, isEmpty(c.ex), D(c.ex.inst));
    setCard($("pv-m-card"), c.m.seq, isEmpty(c.m), D(c.m.inst));
    const wbEmpty = isEmpty(c.wb);
    const wbText = wbEmpty
      ? ""
      : c.wb.control.regwen
      ? `x${c.wb.waddr} ← ${c.wb.wdata}`
      : "(no write)";
    setCard($("pv-wb-card"), c.wb.seq, wbEmpty, wbText);

    paintStageWires("if", c.if.seq, isEmpty(c.if));
    paintStageWires("id", c.id.seq, isEmpty(c.id));
    paintStageWires("ex", c.ex.seq, isEmpty(c.ex));
    paintStageWires("m", c.m.seq, isEmpty(c.m));
    paintStageWires("wb", c.wb.seq, wbEmpty);

    const redirectActive = !isEmpty(c.ex) && (c.ex.flush !== 0 || c.ex.jump_en !== 0);
    paintRoleWires("pc-redirect", redirectActive, colorForSeq(c.ex.seq));
    const writeActive = !wbEmpty && c.wb.control.regwen && c.wb.waddr !== 0;
    paintRoleWires("wb-feedback", writeActive, colorForSeq(c.wb.seq));

    $("box-pc").classList.toggle("pv-frozen", !!c.stall);
    $("pv-if-card").classList.toggle("pv-card-frozen", !!c.stall);

    const FWD_LABEL = { 0: "none", 1: "none", 2: "MX", 3: "WX", 4: "WX+PC4", 5: "MX+PC4" };
    const fwdActive = c.ex.fwdA >= 2 || c.ex.fwdB >= 2 || c.ex.fwdM === 1 || c.ex.fwdrs2EXreg === 1;
    $("pv-forwarding-box").classList.toggle("pv-hazard-active", fwdActive);
    $("pv-forwarding-info").innerHTML =
      `fwdA: ${c.ex.fwdA} (${FWD_LABEL[c.ex.fwdA] ?? c.ex.fwdA})<br>` +
      `fwdB: ${c.ex.fwdB} (${FWD_LABEL[c.ex.fwdB] ?? c.ex.fwdB})<br>` +
      `fwdM: ${c.ex.fwdM}&nbsp;&nbsp;fwdrs2: ${c.ex.fwdrs2EXreg}`;

    $("pv-stalling-box").classList.toggle("pv-hazard-active", !!c.stall);
    $("pv-stalling-info").innerHTML = c.stall
      ? "stall: 1<br>PC / IF-ID frozen"
      : "stall: 0";

    $("pv-flush-box").classList.toggle("pv-hazard-active", c.ex.flush !== 0);
    $("pv-flush-info").innerHTML = c.ex.flush
      ? `flush: ${c.ex.flush}<br>redirecting PC`
      : "flush: 0";

    const ctrl = [
      ["PCSel", c.ex.control.pcsel], ["RegWEn", c.wb.control.regwen],
      ["ImmSel", c.ex.control.immsel], ["ALUSel", c.ex.control.alusel],
      ["ASel", c.ex.control.asel], ["BSel", c.ex.control.bsel],
      ["BrUn", c.ex.control.brun], ["MemRW", c.m.control.memrw],
      ["MemSize", c.m.control.memsize], ["WBSel", c.wb.control.wbsel],
    ];
    $("pv-control-grid").innerHTML = ctrl
      .map(([k, v]) => `<div class="pv-ctrl-pair"><span class="pv-ctrl-k">${k}</span><span class="pv-ctrl-v">${v}</span></div>`)
      .join("");

    setHi("line-mx-a", c.ex.fwdA === 2);
    setHi("line-wx-a", c.ex.fwdA === 3);
    setHi("line-mx-b", c.ex.fwdB === 2);
    setHi("line-wx-b", c.ex.fwdB === 3);
    setHi("line-wm", c.ex.fwdM === 1);

    $("pv-if-card").classList.toggle("pv-card-flushed", !!(c.ex.flush));

    $("pv-annotation").textContent = annotate(c);

    const fields = [
      ["cycle", c.cycle], ["stall", c.stall],
      ["IF.pc", c.if.pc], ["IF.pc_next", c.if.pc_next],
      ["ID.dataA", c.id.dataA], ["ID.dataB", c.id.dataB],
      ["EX.imm", c.ex.imm],
      ["EX.muxa_out (ALU in A)", c.ex.muxa_out], ["EX.muxb_out (ALU in B)", c.ex.muxb_out],
      ["EX.alu_res", c.ex.alu_res],
      ["EX.bcomp_dataA", c.ex.bcomp_dataA], ["EX.bcomp_dataB", c.ex.bcomp_dataB],
      ["EX.brEQ", c.ex.brEQ], ["EX.brLT", c.ex.brLT],
      ["EX.fwdA", c.ex.fwdA], ["EX.fwdB", c.ex.fwdB], ["EX.fwdM", c.ex.fwdM],
      ["EX.fwdrs2EXreg", c.ex.fwdrs2EXreg], ["EX.fwddataAjalr", c.ex.fwddataAjalr],
      ["EX.jal_imm", c.ex.jal_imm], ["EX.jalr_imm", c.ex.jalr_imm], ["EX.jump_en", c.ex.jump_en],
      ["M.alu_res (dmem addr)", c.m.alu_res],
      ["M.mem_write_data", c.m.mem_write_data], ["M.mem_read_data", c.m.mem_read_data],
      ["M.memrw", c.m.control.memrw], ["M.memsize", c.m.control.memsize],
      ["WB.dataD", c.wb.dataD], ["WB.regwen", c.wb.control.regwen],
      ["WB.waddr", c.wb.waddr], ["WB.wdata", c.wb.wdata],
    ];
    $("pv-fields").innerHTML = fields
      .map(([k, v]) => `<div class="pv-field"><span class="pv-field-k">${k}</span><span class="pv-field-v">${v}</span></div>`)
      .join("");
  }

  const NATIVE_W = 1560;
  const NATIVE_H = 610;

  function fitDiagram() {
    const wrap = $("pv-diagram-native").closest(".pv-diagram-wrap");
    const scaleHost = $("pv-diagram-native").parentElement; // .pv-diagram-scale
    const cs = getComputedStyle(wrap);
    const available = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const scale = Math.min(1, available / NATIVE_W);
    $("pv-diagram-native").style.transform = `scale(${scale})`;
    scaleHost.style.height = `${NATIVE_H * scale}px`;
  }

  function init() {
    const picker = $("pv-program");
    picker.innerHTML = PROGRAMS.map((p) => `<option value="${p.id}">${p.label}</option>`).join("");
    picker.addEventListener("change", (e) => loadProgram(e.target.value));

    $("pv-prev").addEventListener("click", stepBack);
    $("pv-next").addEventListener("click", stepForward);
    $("pv-play").addEventListener("click", togglePlay);
    $("pv-scrubber").addEventListener("input", (e) => stepTo(parseInt(e.target.value, 10)));

    document.addEventListener("keydown", (e) => {
      if (!document.getElementById("pipeline-visualizer").contains(document.activeElement) &&
          document.activeElement !== document.body) return;
      if (e.key === "ArrowRight") stepForward();
      if (e.key === "ArrowLeft") stepBack();
    });

    cacheStageWires();
    fitDiagram();
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitDiagram, 100);
    });

    loadProgram(PROGRAMS[0].id);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
