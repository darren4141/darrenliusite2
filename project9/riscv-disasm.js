// Minimal RV32I disassembler -- covers exactly the instruction set
// cpu_pipelined.v implements (see project9.html "Instruction Set Coverage").
// Takes a 32-bit instruction word (as a hex string "0x..." or a number) and
// returns a short mnemonic string, e.g. "addi x1, x0, 5".
(function (global) {
  const REG = (n) => "x" + n;

  function signExtend(val, bits) {
    const shift = 32 - bits;
    return (val << shift) >> shift;
  }

  function fields(word) {
    return {
      opcode: word & 0x7f,
      rd: (word >>> 7) & 0x1f,
      funct3: (word >>> 12) & 0x7,
      rs1: (word >>> 15) & 0x1f,
      rs2: (word >>> 20) & 0x1f,
      funct7: (word >>> 25) & 0x7f,
    };
  }

  function immI(word) {
    return signExtend(word >>> 20, 12);
  }
  function immS(word) {
    const imm = ((word >>> 25) << 5) | ((word >>> 7) & 0x1f);
    return signExtend(imm, 12);
  }
  function immB(word) {
    const imm =
      (((word >>> 31) & 0x1) << 12) |
      (((word >>> 7) & 0x1) << 11) |
      (((word >>> 25) & 0x3f) << 5) |
      (((word >>> 8) & 0xf) << 1);
    return signExtend(imm, 13);
  }
  function immU(word) {
    return word & 0xfffff000;
  }
  function immJ(word) {
    const imm =
      (((word >>> 31) & 0x1) << 20) |
      (((word >>> 12) & 0xff) << 12) |
      (((word >>> 20) & 0x1) << 11) |
      (((word >>> 21) & 0x3ff) << 1);
    return signExtend(imm, 21);
  }

  const R_OPS = {
    "0_0x0": "add", "32_0x0": "sub", "0_0x4": "xor", "0_0x6": "or",
    "0_0x7": "and", "0_0x1": "sll", "0_0x5": "srl", "32_0x5": "sra",
    "0_0x2": "slt", "0_0x3": "sltu",
  };
  const I_ARITH_OPS = {
    0x0: "addi", 0x4: "xori", 0x6: "ori", 0x7: "andi",
    0x2: "slti", 0x3: "sltiu", 0x1: "slli", 0x5: null, // srli/srai disambiguated below
  };
  const LOAD_OPS = { 0x0: "lb", 0x1: "lh", 0x2: "lw", 0x4: "lbu", 0x5: "lhu" };
  const STORE_OPS = { 0x0: "sb", 0x1: "sh", 0x2: "sw" };
  const BRANCH_OPS = { 0x0: "beq", 0x1: "bne", 0x4: "blt", 0x5: "bge", 0x6: "bltu", 0x7: "bgeu" };

  function disassemble(wordInput) {
    let word = typeof wordInput === "string" ? parseInt(wordInput, 16) : wordInput;
    word = word >>> 0;
    if (word === 0 || word === 0x00000033 /* add x0,x0,x0 -- the bubble/NOP encoding */) {
      return "nop";
    }
    const f = fields(word);

    switch (f.opcode) {
      case 0x33: {
        const key = `${f.funct7}_0x${f.funct3.toString(16)}`;
        const op = R_OPS[key] || "r-op?";
        return `${op} ${REG(f.rd)}, ${REG(f.rs1)}, ${REG(f.rs2)}`;
      }
      case 0x13: {
        if (f.funct3 === 0x1) return `slli ${REG(f.rd)}, ${REG(f.rs1)}, ${f.rs2}`;
        if (f.funct3 === 0x5) {
          const op = f.funct7 === 0x20 ? "srai" : "srli";
          return `${op} ${REG(f.rd)}, ${REG(f.rs1)}, ${f.rs2}`;
        }
        const op = I_ARITH_OPS[f.funct3] || "i-op?";
        return `${op} ${REG(f.rd)}, ${REG(f.rs1)}, ${immI(word)}`;
      }
      case 0x03: {
        const op = LOAD_OPS[f.funct3] || "load?";
        return `${op} ${REG(f.rd)}, ${immI(word)}(${REG(f.rs1)})`;
      }
      case 0x67:
        return `jalr ${REG(f.rd)}, ${immI(word)}(${REG(f.rs1)})`;
      case 0x23: {
        const op = STORE_OPS[f.funct3] || "store?";
        return `${op} ${REG(f.rs2)}, ${immS(word)}(${REG(f.rs1)})`;
      }
      case 0x63: {
        const op = BRANCH_OPS[f.funct3] || "branch?";
        return `${op} ${REG(f.rs1)}, ${REG(f.rs2)}, ${immB(word)}`;
      }
      case 0x37:
        return `lui ${REG(f.rd)}, 0x${(immU(word) >>> 12).toString(16)}`;
      case 0x17:
        return `auipc ${REG(f.rd)}, 0x${(immU(word) >>> 12).toString(16)}`;
      case 0x6f:
        return `jal ${REG(f.rd)}, ${immJ(word)}`;
      default:
        return `unknown(0x${word.toString(16).padStart(8, "0")})`;
    }
  }

  const api = { disassemble };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.RiscvDisasm = api;
})(typeof window !== "undefined" ? window : globalThis);
