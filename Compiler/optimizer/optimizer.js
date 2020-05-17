
const nodeopts = require("./node-optimizer");

class Optimizer {
    // Crear un optimizador, el ast es generado por parsear el codigo
    //      type: el tipo de optimizacion    
    constructor(ast, type) {
        this.ast = ast;
        this.type = type;
        this.linealized = [];
        this.optimized = [];
        this.optimizations = [];
        this.id = 0;
        this.window = 100;
        this.windowPos = 0;
        this.iterations = 10;
    }

    getDefaultNode() {
        return { type: "custom", id: -1, value: {}, str: function () { return ""; } };
    }

    getBeginNode() {
        return { type: "custom", id: -1, value: {}, str: function () { return "INICIO"; } };
    }

    getEndNode() {
        return { type: "custom", id: -1, value: {}, str: function () { return "FINAL"; } };
    }

    getRulesFromWindow() {

        let buffStart = this.windowPos;
        let buffEnd = buffStart + this.window;

        this.windowPos += this.window;
        let buff = this.optimized.slice(buffStart, buffEnd);

        if (buff.length == 0) {
            return null;
        }

        //agregar siempre un ultimo elemento para evitar errores
        buff.push(this.getDefaultNode());
        return buff;
    }

    getExp(node) {
        return node.exp.str().trim();
    }

    addOpt(rule, initial, final, node) {
        this.optimizations.push({
            regla: rule,
            inicial: initial.replace(new RegExp("\n", "g"), "<br>"),
            final: final.replace(new RegExp("\n", "g"), "<br>"),
            linea: node.line,
            col: node.col + 1
        });
    }

    rule1(stmts) {
        // iterar en pares en busqueda de
        // tn = c
        // c = tn
        let result = [];
        for (var i = 0; i < stmts.length - 1; i++) {
            let curr = stmts[i];
            let next = stmts[i + 1];

            if (curr.type == "asignacion" && next.type == "asignacion") {
                // obtener valores de asignacion
                // an1 = av1
                // an2 = an2
                let an1 = curr.ids[0].trim();
                let av1 = this.getExp(curr);

                let an2 = next.ids[0].trim();
                let av2 = this.getExp(next);

                // an2 = av1
                // an1 = av2
                if (an2 == av1 && an1 == av2) {
                    result.push(curr);
                    // saltarse la proxima, ya que fue eliminada
                    i++;
                    this.addOpt(1, `${curr.str()}\n${next.str()}`, `${curr.str()}`, curr);
                    continue;
                }
            }

            result.push(curr);
        }

        return this.rule2(result);
    }

    rule2(stmts) {
        let result = [];
        for (let i = 0; i < stmts.length; i++) {
            let curr = stmts[i];

            if (curr.type == "goto") {
                let skip = 0;
                let lbl = curr.value;
                let matched;
                //buscar si existe una etiqueta con ese valor
                for (let j = i + 1; j < stmts.length; j++) {
                    matched = stmts[j];
                    skip++;
                    if (matched.type == "label") {
                        break;
                    }
                }

                // si la primera etiqueta que encuentra
                // es igual a la del goto
                // entonces todos los nodos que existian en ese punto deben ser eliminados
                if (matched && lbl === matched.value) {
                    // olvidar todos los nodos hasta este punto
                    i = i + skip;
                    //guardar la optimizacion
                    this.addOpt(2, `${curr.str()}\n[instrucciones...]\n${matched.str()}`, `${matched.str()}`, curr);
                    result.push(matched);
                }
                else {
                    result.push(curr);
                }
            }
            else {
                result.push(curr);
            }
        }
        return this.rule3(result);
    }

    rule3(stmts) {
        let result = [];
        stmts.push(this.getDefaultNode);

        for (let i = 0; i < stmts.length - 1; i++) {
            let curr = stmts[i];
            let next = stmts[i + 1];

            if (curr.type == "if" && next.type == "goto") {
                // obtener datos del if
                let ifExp = curr.value.exp;
                let ifLbl = curr.value.lbl;

                // obtener datos del goto
                let goLbl = next.value;
                let falseLabel;
                let trueLabel;

                let truenodes = [];
                let canOptimize = false;
                let skip = 0;

                let ifLblIndex = i + 2;
                if (ifLblIndex < stmts.length
                    && stmts[ifLblIndex].type == "label"
                    && stmts[ifLblIndex].value == ifLbl) {

                    trueLabel = stmts[ifLblIndex];

                    // obtener todos los nodos verdaderos
                    for (let j = i + 3; j < stmts.length; j++) {
                        let trueNode = stmts[j];
                        skip++;
                        if (trueNode.type == "label" && trueNode.value == goLbl) {
                            // ya llego al fin de los nodos verdaderos
                            // realizar optimizacion
                            canOptimize = true;
                            falseLabel = trueNode;
                            break;
                        }
                        else {
                            truenodes.push(trueNode);
                        }
                    }
                }

                // si se puede optimizar y la expresion tiene un operador inverso
                if (canOptimize && ifExp.reverseOperator) {
                    // cambiar los valores del operador

                    let initialStr = `${curr.str()}\n${next.str()}\n${trueLabel.str()}\n\t[instrucciones]\n${falseLabel.str()}`;
                    let operator = curr.value.exp.operator;
                    curr.value.exp.operator = ifExp.reverseOperator;
                    curr.value.exp.reverseOperator = operator;

                    curr.value.lbl = goLbl;
                    result.push(curr);

                    truenodes.forEach(tn => {
                        result.push(tn);
                    });

                    result.push(falseLabel);
                    i = ifLblIndex + skip;

                    this.addOpt(3, initialStr, `${curr.str()}\n[instrucciones]\n${falseLabel.str()}`, curr);

                    continue;
                }
            }

            result.push(curr);
        }

        return this.rule4And5(result);
    }

    rule4And5(stmts) {
        let result = [];

        stmts.push(this.getDefaultNode());

        for (let i = 0; i < stmts.length - 1; i++) {
            let curr = stmts[i];
            let next = stmts[i + 1];

            if (curr.type == "if" && next.type == "goto") {
                let ifExp = curr.value.exp;

                if (ifExp.has3) {
                    // Regla 4
                    if (ifExp.isNum1
                        && ifExp.isNum2
                        && ifExp.val == true) {

                        let oldGoto = next.value;
                        next.value = curr.value.lbl;
                        result.push(next);
                        this.addOpt(4, `${curr.str()}\ngoto ${oldGoto};`, `${next.str()}`, curr);
                        i++;
                        continue;
                    }

                    // Regla 5
                    else if (ifExp.isNum1
                        && ifExp.isNum2
                        && ifExp.val == false) {

                        result.push(next);
                        this.addOpt(5, `${curr.str()}\n${next.str()}`, `${next.str()}`, curr);
                        i++;
                        continue;
                    }

                }
            }

            result.push(curr);
        }

        return this.rule6And7(result);
    }

    rule6And7(stmts) {
        let result = [];

        for (let i = 0; i < stmts.length; i++) {
            let curr = stmts[i];

            if (curr.type == "goto" || curr.type == "if") {
                let isGoto = curr.type == "goto";
                let lbl = isGoto ? curr.value : curr.value.lbl;
                let matched;
                let gotoNode;
                let canOptimize = false;

                for (let j = i; j < stmts.length - 1; j++) {
                    let node = stmts[j];

                    if (node.type == "label" && node.value == lbl) {
                        matched = node;
                        gotoNode = stmts[j + 1];
                        canOptimize = gotoNode.type == "goto";
                        break;
                    }
                }

                if (canOptimize) {
                    if (isGoto) {
                        this.addOpt(6, `goto ${lbl};\n[Instrucciones]\n${matched.str()}\n${gotoNode.str()}`, `${gotoNode.str()}\n[Instrucciones]\n${matched.str()}\n${gotoNode.str()}`, curr);
                        result.push(gotoNode);
                    }
                    else {
                        let initial = `${curr.str()};\n[Instrucciones]\n${matched.str()}\n${gotoNode.str()}`;
                        curr.value.lbl = gotoNode.value;
                        this.addOpt(7, initial, `${curr.str()}\n[Instrucciones]\n${matched.str()}\n${gotoNode.str()}`, curr);
                        result.push(curr);
                    }
                    continue;
                }
            }

            result.push(curr);
        }

        return this.aritmethicRules(result);
    }

    aritmethicRules(stmts) {
        let result = [];

        for (let i = 0; i < stmts.length; i++) {
            let curr = stmts[i];

            if (curr.type == "asignacion") {
                let exp = curr.exp;
                let id = curr.ids[0];

                if (exp.has3) {
                    let v1 = exp.val1;
                    let v2 = exp.val2;
                    let operator = exp.operator;

                    switch (operator) {
                        case "*":
                        case "+":
                            let v1Cond = operator == "*" ? v1.isOne : v1.isCero;
                            let v2Cond = operator == "*" ? v2.isOne : v2.isCero;

                            // aplicar regla 8 o 9
                            if (v1Cond || v2Cond) {

                                // revisar si la variable se llama igual que le id al que se asignara
                                if (v1Cond && v2.value == id
                                    || v2Cond && v1.value == id) {

                                    this.addOpt(operator == "+" ? 8 : 10, `${curr.str()}`, `# removido`, curr);
                                    // no push ya que se elimina
                                    continue;
                                }
                                // si la variable es diferente a la asignacion, borrar la expresion
                                // regla 12 o 13
                                else {
                                    let cv = curr.str();
                                    if (v1Cond) {
                                        exp.val1 = exp.val2;
                                    }
                                    curr.exp.operator = null;
                                    this.addOpt(operator == "+" ? 12 : 14, cv, `${curr.str()}`, curr);
                                    result.push(curr);
                                    continue;
                                }
                            }

                            if (operator == "*" && (v1.isCero || v2.isCero)) {
                                let cv = curr.str();
                                exp.val1.value = 0;
                                exp.val1.type = "num";
                                exp.val1.isCero = true;

                                curr.exp.operator = null;

                                this.addOpt(17, cv, `${curr.str()}`, curr);
                                result.push(curr);
                                continue;
                            }

                            if (operator == "*" && (v1.isTwo || v2.isTwo)) {
                                let cv = curr.str();
                                curr.exp.operator = "+";
                                if (v1.isTwo) {
                                    curr.exp.val1.value = exp.val2.value;
                                }
                                else {
                                    curr.exp.val2.value = exp.val1.value;
                                }

                                this.addOpt(16, cv, `${curr.str()}`, curr);
                                result.push(curr);
                                continue;
                            }
                            break;

                        case "-":
                            if (v2.isCero) {
                                // remover la operacion
                                if (v1.value == id) {
                                    this.addOpt(9, `${curr.str()}`, `# removido`, curr);
                                    // no push ya que se elimina
                                    continue;
                                }
                                else {
                                    let cv = curr.str();
                                    curr.exp.operator = null;
                                    this.addOpt(13, cv, `${curr.str()}`, curr);
                                    result.push(curr);
                                    continue;
                                }
                            }
                            break;

                        case "/":
                            if (v2.isOne) {
                                // remover la operacion
                                if (v1.value == id) {
                                    this.addOpt(11, `${curr.str()}`, `# removido`, curr);
                                    // no push ya que se elimina
                                    continue;
                                }
                                else {
                                    let cv = curr.str();
                                    curr.exp.operator = null;
                                    this.addOpt(15, cv, `${curr.str()}`, curr);
                                    result.push(curr);
                                    continue;
                                }
                            }

                            if (v1.isCero) {
                                let cv = curr.str();

                                exp.val1.value = 0;
                                exp.val1.type = "num";
                                exp.val1.isCero = true;

                                curr.exp.operator = null;

                                this.addOpt(18, cv, `${curr.str()}`, curr);
                                result.push(curr);
                                continue;
                            }
                            break;
                    }

                }
            }

            result.push(curr);
        }

        return result;
    }

    getOptimizations() {
        return this.optimizations;
    }

    linealize() {
        let current = this;
        this.ast.runAndApply(function (node, carry) {
            let lnode = nodeopts.linealizeNode(node);
            let lineandcol = { line: 0, col: 0 };
            if (lnode.type) {
                lnode.id = current.id++;
                lineandcol = node.getLineAndCol();
                lnode.line = lineandcol.line;
                lnode.col = lineandcol.col;
                current.linealized.push(lnode);
            }
        }, {});
    }

    optimizeIteration() {
        this.windowPos = 0;
        let stmts = this.getRulesFromWindow();
        let result = [];
        let optimizedIteration = [];

        while (stmts != null) {
            result = this.rule1(stmts);

            result.forEach(stmt => {
                optimizedIteration.push(stmt);
            });

            stmts = this.getRulesFromWindow();
        }

        this.optimized = optimizedIteration;
    }

    optimize() {
        this.linealize();

        let result = `# -- Codigo optimizado por ${this.type == 1 ? "MIRILLA" : "BLOQUES"} --\n`;

        if (this.type == 1) {
            console.log("Optimizando por mirilla...")
            this.optimized = this.linealized;

            for (let i = 0; i < this.iterations; i++) {
                this.optimizeIteration();
            }

            this.optimized.forEach(node => {
                result += `${node.str()}\n`;
            });

            return result;
        }
        else {
            console.log("Optimizando por bloques...");
            result += this.blockOptimize();
        }

        return result;
    }

    segmentateAsProcs() {

        // dividir en procededimientos para hacer subgrafos

        let ids = 1;
        let glbIds = 1;
        let proc = { name: "$_GLOBAL1_$", id: 0, contents: [] };
        let procs = [];

        this.linealized.forEach(node => {
            // iniciar nuevo procedimiento
            if (node.type == "proc") {
                if (proc) {
                    procs.push(proc);
                }
                proc = { name: node.value, id: ids++, contents: [] };
            }
            // guardar el procedimiento y volver a global
            else if (node.type == "end") {
                procs.push(proc);
                proc = null;
            }
            // guardar el nodo actual en el procedimiento que se encuentra
            else if (proc) {
                proc.contents.push(node);
            }
            // guardar en el ambito global
            else {
                // crear un nuevo ambiente y guardarlo
                proc = { name: `$_GLOBAL${++glbIds}_$`, id: ids++, contents: [node] };
            }
        });

        if (proc) {
            procs.push(proc);
        }

        return procs;
    }

    segmentate(stmts) {

        // agregar una parte mas para evitar problemas al agregar todos
        stmts.push(this.getDefaultNode());

        let parts = [];
        let part = null;
        let id = 0;

        // crear una nueva parte
        let partFactory = function (customId, content, type, reference, invis, color) {
            return {
                id: customId || id++,
                content: content,
                type: type,
                reference: reference || null,
                invis: invis || false,
                color: color || "red"
            };
        }

        // agregar un nodo "inicial"
        parts.push(partFactory(null, [this.getBeginNode()], "custom", null, null, "grey"));

        // agregar todos los nodos y dividirlos por partes
        stmts.forEach(node => {

            // si el tipo de nodo forza un cierre
            if (node.type == "label" || node.type == "goto" || node.type == "if") {

                // Si la parte anterior tenia contenido
                if (part && part.content && part.content.length > 0) {
                    // guardar parte vieja
                    parts.push(part);
                }

                // si es un goto o un if, agregar la parte de una vez y crear una nueva, vacia
                if (node.type == "goto" || node.type == "if") {
                    parts.push(partFactory(null, [node], node.type, node.reference, node.invis, node.type == "if" ? "green" : "orange"));
                    part = null;
                }
                // si es un label, crear una pero no agregarla
                else {
                    part = partFactory(node.value, [node], node.type, null, null, "blue");
                }
            }
            // si no es una parte que forza un cierre
            // debe agregarse a la parte actual
            else if (node.type != "custom") {
                // si no existe una parte actual (viene de un goto o un if)
                if (part == null) {
                    part = partFactory(null, [node], node.type);
                }
                // si ya existe una parte (viene de un label, o el inicio)
                else {
                    part.content.push(node);
                }
            }
        });

        // si aun hay una parte por guardar, terminar de guardarla
        if (part && part.content && part.content.length > 0) {
            parts.push(part);
        }

        // agregar un nodo "final"
        parts.push(partFactory(null, [this.getEndNode()], "custom", null, null, "grey"));

        return parts;
    }

    blockOptimize() {
        let procs = this.segmentateAsProcs();
        let _this = this;

        const cd_reduce = (code, p) => { return code + (p.type == "custom" ? "" : ("\n" + p.str())); }
        const pt_reduce = (code, p) => { return code + (p.inactive ? "" : p.content.reduce(cd_reduce, "")); };

        const pr_reduce = (code, p) => {
            let envelop = p.name.indexOf("$_") == -1;
            let blocks = p.blocks.reduce(pt_reduce, "");
            if (envelop) {
                return code + `\nproc ${p.name} begin${blocks}\nend`;
            }
            return code + blocks;
        };


        // iterar todos los procedimientos, creando un subgrafo para cada uno
        procs.forEach(proc => {

            let tmps = {};
            let idtmps = 1;
            let regEqls = {};
            let used = {};
            let assigned = {};

            const check_value_changed = (tmp) => {
                return Object.entries(tmps).reduce((e, v) => {

                    if (!e) {
                        let val = v[1];

                        let currTmp = tmp.pos;
                        // si la expresion fue declarada despues de la expresion a utilizar
                        if (currTmp < val.pos) {
                            // valores utilizados en la expresion a buscar
                            let val1 = tmp.exp.val1;
                            let val2 = tmp.exp.val2;
                            // valor al que se le esta asignando en la expresion actual
                            let asV = val.lbl;

                            // revisar si alguno de los valores
                            // en la expresion actual
                            // tuvo una asignacion
                            return val1 && val1.value && val1.value == asV
                                || val2 && val2.value && val2.value == asV;
                        }
                    }

                    return e;
                }, false);
            };

            let blocks = this.segmentate(proc.contents);

            // revisar reglas 19
            for (let i = 0; i < blocks.length; i++) {
                let curr = blocks[i];

                if (curr.inactive) {
                    continue;
                }

                // Regla 19
                if (curr.type == "if") {
                    let exp = curr.content[0].value.exp;
                    let lbl = curr.content[0].value.lbl;
                    let result = exp.val;

                    if (typeof result !== "boolean") {
                        continue;
                    }
                    // si el resultado es falso
                    if (!result && exp.has3) {
                        //irse al codigo y desactivarlo
                        for (let j = i + 1; j < blocks.length; j++) {
                            let sblock = blocks[j];

                            if (sblock.type == "label") {
                                let matchLbl = sblock.content[0].value;
                                if (matchLbl == lbl) {
                                    // regla 19
                                    sblock.inactive = true;
                                    curr.inactive = true;
                                    _this.addOpt(19,
                                        `${curr.content.reduce(cd_reduce, "")}\n[Instrucciones]\n${sblock.content.reduce(cd_reduce, "")}`,
                                        `# removido etiqueta de verdadero`,
                                        curr.content[0]
                                    );
                                }
                                break;
                            }
                        }
                    }

                    else if (result) {
                        for (let j = i + 1; j < blocks.length; j++) {
                            let sblock = blocks[j];

                            if (sblock.type == "label") {
                                let matchLbl = sblock.content[0].value;
                                if (matchLbl == lbl) {
                                    // regla 19
                                    curr.inactive = true;
                                    _this.addOpt(19,
                                        `${curr.content.reduce(cd_reduce, "")}\n[Instrucciones]\n${sblock.content.reduce(cd_reduce, "")}`,
                                        `# removido codigo falso`,
                                        curr.content[0]
                                    );
                                }
                                break;
                            }
                            else {
                                sblock.inactive = true;
                            }
                        }
                    }
                }

                proc.blocks = blocks;
            }

            // revisar regla 20
            for (let i = 0; i < blocks.length - 1; i++) {

                let curr = blocks[i];
                let next = blocks[i + 1];

                if (curr.inactive) {
                    continue;
                }

                if (curr.type == "if" && next.type == "goto") {
                    let lblIf = curr.content[0].value.lbl;
                    let lblGt = next.content[0].value;
                    let hasOptimized = false;
                    let optimizedStr = "";
                    // iterrar todo hasta que se encuentre la primera etiqueta del if o del goto
                    for (let j = i + 2; j < blocks.length; j++) {
                        let matched = blocks[j];
                        if (matched.type == "label") {
                            let lblMatched = matched.content[0].value;
                            if (lblMatched == lblIf || lblMatched == lblGt) {
                                if (hasOptimized) {
                                    _this.addOpt(
                                        20,
                                        `${optimizedStr}`,
                                        `# removido sentencias de codigo muerto`,
                                        curr.content[0]
                                    );
                                }
                                break;
                            }
                        }
                        else {
                            hasOptimized = true;
                            optimizedStr += matched.content.reduce(cd_reduce, "") + "\n";
                            matched.inactive = true;
                        }
                    }
                }
            }

            // revisar regla 21
            blocks.forEach(block => {
                block.content.forEach(node => {
                    if (node.type == "asignacion") {
                        let exp = node.exp.str();
                        let tmp = node.ids[0];
                        let currTmp = tmps[exp];

                        // revisar si alguno de los dos valores
                        // de la expresion actual, cambiaron
                        if (currTmp && !check_value_changed(currTmp) && currTmp.lbl != tmp) {

                            let last = node.str();
                            regEqls[tmp] = currTmp.tmp;
                            node.exp.val1 = {
                                value: currTmp.tmp,
                                type: "tmp",
                                isCero: false,
                                isOne: false,
                                isTwo: false
                            };

                            node.exp.val2 = null;
                            node.exp.operator = null;
                            node.exp.reverseOperator = null;
                            node.exp.isNum1 = false;
                            node.exp.isNum2 = false;
                            node.exp.has3 = false;
                            node.exp.val = null;

                            _this.addOpt(21, last, node.str(), node);
                        }
                        else {
                            tmps[exp] = {
                                lbl: tmp,
                                pos: idtmps++,
                                exp: node.exp,
                                tmp: tmp
                            };
                        }

                    }
                })
            });

            // revisar regla 22
            blocks.forEach(block => {
                block.content.forEach(node => {
                    if (node.type == "asignacion") {
                        let exp = node.exp;
                        let last = node.str();

                        if (regEqls[exp.val1.value]) {
                            node.exp.val1.value = regEqls[exp.val1.value];
                            _this.addOpt(22, last, node.str(), node);
                        }
                        if (exp.val2 && regEqls[exp.val2.value]) {
                            node.exp.val2.value = regEqls[exp.val2.value];
                            _this.addOpt(22, last, node.str(), node);
                        }
                    }
                })
            });

            // revisar regla 23

            // primero llenar todos los temporales usados y asignados
            blocks.forEach(block => {
                block.content.forEach(node => {
                    if (node.type == "asignacion") {
                        let assignLbl = node.ids[0];
                        let exp = node.exp;
                        assigned[assignLbl] = { lbl: assignLbl, node: node };
                        if (exp.val1 && exp.val1.value && exp.val1.type == "tmp") {
                            used[exp.val1.value] = true;
                        }
                        
                        if (exp.val2 && exp.val2.value && exp.val2.type == "tmp") {
                            used[exp.val2.value] = true;
                        }
                    }
                });
            });

            // revisar que nodos fueron asignados pero nunca utilizados
            Object.entries(assigned).forEach(e => {
                let lbl = e[1].lbl;

                if (!used[lbl]){
                    // hack para que el recolector de codigo no agregue este nodo
                    let initStr = e[1].node.str();
                    e[1].node.type = "custom";
                    _this.addOpt(23, initStr, `# removido por ser inutilizado`, e[1].node);
                }
            });
        });

        return procs.reduce(pr_reduce, "");
    }

    getSubgraphs() {
        let procs = this.segmentateAsProcs();
        let _this = this;

        let subgraphs = [];

        // iterar todos los procedimientos, creando un subgrafo para cada uno
        procs.forEach(proc => {

            const reduce_parts = (graph, part) => {
                return graph + _this.blockAsGraphviz(`${proc.id}${part.id}`, part.content.reduce((g, v) => { return g + `${sanitize(v.str())}\n` }, ""), part.color);
            };

            // realizar las conexiones entre nodos
            let links = "";
            let parts = this.segmentate(proc.contents);
            const cont_length = parts.length;
            const content = parts;

            for (let i = 0; i < cont_length - 1; i++) {
                let curr = content[i];
                let next = content[i + 1];

                let curr_id = `${proc.id}${curr.id}`;
                let next_id = `${proc.id}${next.id}`;

                // si el otro requiere una conexion invisible (para dar un mejor formato a la imagen)
                if (next.invis || curr.type == "if")
                    links += this.connectInvis(curr_id, next_id);
                else
                    links += this.connect(curr_id, next_id);

                // si el actual requiere una conexion aparte
                if (curr.reference) {
                    if (curr.type == "if")
                        links += this.connectInvis(curr_id, `${proc.id}${curr.reference}`);
                    else
                        links += this.connect(curr_id, `${proc.id}${curr.reference}`);
                }
            }

            subgraphs.push(
                `subgraph cluster_${proc.id} {
                    style=filled; 
                    color=lightgrey;
                    label= "${proc.name}";
                    ${parts.reduce(reduce_parts, "")} 
                    ${links}
                }`
            );
        });

        return subgraphs.reduce((a, v) => a + "\n" + v, "");
    }

    getGraph() {
        return `digraph B {\n\trankdir=TB;\n${this.getSubgraphs()} }`;
    }

    nodeAsGraphviz(node) {
        return sanitize(node) + "\n";
    }

    blockAsGraphviz(id, block, color) {
        return `\tid_${id} [fontcolor=white shape=component style=filled color=${color || "grey"} label="${block}"];\n`;
    }

    connect(id1, id2) {
        return `\tid_${id1} -> id_${id2} [shape=box color=turquoise4];\n`;
    }

    connectInvis(id1, id2) {
        return `\tid_${id1} -> id_${id2} [style=dashed color=grey37];\n`;
    }
}

function sanitize(str) {
    if (str == null || str == undefined) {
        return "";
    }

    str = str + "";

    return str
        .replace(new RegExp("\"", "g"), "\\\"")
        .replace(new RegExp("&", "g"), "&amp;")
        .replace(new RegExp("<", "g"), "&lt;")
        .replace(new RegExp(">", "g"), "&gt;");
}

exports.Optimizer = Optimizer;