
const c3dTemplates = require("./C3DTemplates");
const validator = require("./validator");
const logger = require("../logger");
const SymTbl = require("../symtbl").SymTbl;

let types = validator.OpTyp;

class C3DConversor {

    constructor(symtbl) {

        this.symtbl = symtbl;

        this.info = {
            resultCode: initial_code,
            temporals: 0,
            labels: 48,
            data: {},
            P: "P",
            K: "H",
            breakLabel: null,
            continueLabel: null,
            activationTmps: [],

            createTemporal: function (doNotPushToActivation) {
                let tmp = "t" + this.temporals++;
                if (!doNotPushToActivation) {
                    this.activationTmps.push(tmp);
                }
                return tmp;
            },

            getRelativePos: function (relative, lookInHeap) {
                let tmp = this.createTemporal();
                this.add(`${tmp} = ${lookInHeap ? this.K : this.P} + ${relative};`);
                return tmp;
            },

            getRelativePosWithoutSave: function (relative) {
                let tmp = this.createTemporal(true);
                this.add(`${tmp} = ${this.P} + ${relative};`);
                return tmp;
            },

            createLabel: function () {
                return "L" + this.labels++;
            },

            add: function (code) {
                this.resultCode += "\n" + code;
            },

            addToStack: function (pos, val) {
                this.add(`stack[${pos}] = ${val};`);
            },

            stack: function (val) {
                this.addToStack(this.P, val);
                this.add(`${this.P} = ${this.P} + 1;`);
            },

            addToHeap: function (pos, val) {
                this.add(`heap[${pos}] = ${val};`);
            },

            heap: function (val) {
                this.addToHeap(this.K, val);
                this.add(`${this.K} = ${this.K} + 1;`);
            },

            getP: function () {
                let tmp = this.createTemporal();
                this.add(`${tmp} = ${this.P};`);
                return tmp;
            },

            getK: function () {
                let tmp = this.createTemporal();
                this.add(`${tmp} = ${this.K};`);
                return tmp;
            },

            setP: function (val) {
                this.add(`${this.P} = ${val};`);
            },

            setK: function (val) {
                this.add(`${this.K} = ${val};`);
            },

            getFromStack: function (pos, assignFirst) {
                let tmp = this.createTemporal();

                if (assignFirst) {
                    this.add(`${tmp} = ${pos};`);
                    this.add(`${tmp} = stack[${tmp}];`);

                }
                else
                    this.add(`${tmp} = stack[${pos}];`);

                return tmp;
            },

            getFromHeap: function (pos) {
                let tmp = this.createTemporal();

                this.add(`${tmp} = heap[${pos}];`);

                return tmp;
            },

            changeScope: function (size) {
                this.add(`${this.P} = ${this.P} + ${size};`);
            },

            returnScope: function (size) {
                this.add(`${this.P} = ${this.P} - ${size};`);
                //TODO: $$_clean scope
            },

            addParams: function (params) {
                if (Array.isArray(params)) {
                    //this.add("//adding params");
                    params.forEach((param) => {
                        let pos = this.getRelativePos(param.relative);
                        let val = param.val;

                        this.addToStack(pos, val);
                    });
                }
            },

            call: function (call_info) {
                let current_size = this.data.size;
                this.changeScope(current_size);
                let parameters = call_info.params;
                this.addParams(parameters);
                this.add(`call ${call_info.name};`);
                let return_val = "";
                //console.log("CALL INFO", call_info);
                if (call_info.return) {
                    let return_pos = call_info.funct_info.return_pos;
                    //if (call_info.funct_info.return_relative)
                    return_pos = `${this.P} + ${return_pos}`;

                    return_val = this.getFromStack(return_pos, true);
                }

                this.returnScope(current_size);
                return return_val;
            }
        };

        this.processBinaryOpt = function (operand1, operator, operand2) {
            let resultType = validator.validateExpression(operand1, operand2, operator);
            let o1 = operand1.return;
            let o2 = operand2.return;
            let temporal = "";
            let templates = new c3dTemplates.Template(this.info);

            let castToString = function (current, cast_function_name, operand, type) {
                return current.info.call({
                    name: cast_function_name,
                    params: [{
                        val: operand,
                        type: type,
                        relative: 0
                    }],
                    return: true,
                    funct_info: {
                        params: 1,
                        size: 0,
                        return: true,
                        return_pos: 1,
                        return_relative: true
                    }
                });
            };

            switch (operator) {
                case "+":
                    //if concatenating
                    if (resultType == types.STR) {
                        //temp values, hold K position of both strings
                        let tmp1;
                        let tmp2;
                        //recover K position if operand is string
                        //else convert it and save it in heap
                        switch (operand1.type) {
                            case types.STR:
                                tmp1 = o1;
                                break;

                            case types.INT:
                                tmp1 = castToString(this, "__convert_int__", o1, operand1.type);
                                break;

                            case types.BOL:
                                tmp1 = castToString(this, "__convert_bool__", o1, operand1.type);
                                break;

                            case types.CHR:
                                tmp1 = castToString(this, "__convert_char__", o1, operand1.type);
                                break;

                            case types.DBL:
                                tmp1 = castToString(this, "__convert_dbl__", o1, operand1.type);
                                break;

                            default:
                                throw { msg: "El valor a concatenar no es valido", token: "La operacion no retorno un valor valido", operator: o1 };
                        }

                        switch (operand2.type) {
                            case types.STR:
                                tmp2 = o2;
                                break;

                            case types.INT:
                                tmp2 = castToString(this, "__convert_int__", o2, operand2.type);
                                break;

                            case types.BOL:
                                tmp2 = castToString(this, "__convert_bool__", o2, operand2.type);
                                break;

                            case types.CHR:
                                tmp2 = castToString(this, "__convert_char__", o2, operand2.type);
                                break;

                            case types.DBL:
                                tmp2 = castToString(this, "__convert_dbl__", o2, operand2.type);
                                break;

                            default:
                                throw { msg: "El valor a concatenar no es valido", token: "La operacion no retorno un valor valido", operator: o2 };
                        }

                        if (!tmp1 || !tmp2)
                            throw { msg: "Operandos invalidos o concatenacion invalida", token: "Error en la concatenacion", operators: [o1, o2] };

                        let params = [{
                            val: tmp1,
                            type: operand1.type,
                            relative: 0
                        }, {
                            val: tmp2,
                            type: operand2.type,
                            relative: 1
                        }];

                        temporal = this.info.call({
                            name: "__concat__",
                            params: params,
                            return: true,
                            funct_info: {
                                params: 2,
                                size: 0,
                                return: true,
                                return_pos: 2,
                                return_relative: true
                            }
                        });
                    }
                    else {
                        temporal = this.info.createTemporal();
                        this.info.add(temporal + " = " + o1 + " " + operator + " " + o2 + ";");
                    }

                    break;

                case "-":
                case "*":
                case "/":
                case "%":
                    temporal = this.info.createTemporal();
                    this.info.add(temporal + " = " + o1 + " " + operator + " " + o2 + ";");
                    break;

                case "<":
                case ">":
                case "<=":
                case ">=":
                    temporal = templates.createRelational(o1, o2, operator);
                    this.info = templates.info;
                    break;
                case "==":
                case "!=":
                    if (operand1.type == types.STR || operand2.type == types.STR) {
                        temporal = this.info.call({
                            name: "__compare_strings__",
                            params: [{
                                val: o1,
                                type: operand1.type,
                                relative: 0
                            }, {
                                val: o2,
                                type: operand2.type,
                                relative: 1
                            }],
                            return: true,
                            funct_info: {
                                params: 2,
                                size: 2,
                                return: true,
                                return_pos: 2,
                                return_relative: true
                            }
                        });

                        if (operator == "!=") {
                            this.info.add(`${temporal} = 1 - ${temporal};`);
                        }

                    } else {
                        temporal = templates.createRelational(o1, o2, operator == "!=" ? "<>" : operator);
                        this.info = templates.info;
                    }

                    break;

                case "^^":
                    temporal = this.info.call({
                        name: "__pow__",
                        params: [{
                            val: o1,
                            type: operand1.type,
                            relative: 0
                        }, {
                            val: o2,
                            type: operand2.type,
                            relative: 1
                        }],
                        return: true,
                        funct_info: {
                            params: 2,
                            size: 2,
                            return: true,
                            return_pos: 2,
                            return_relative: true
                        }
                    });
                    break;

                case "===":
                    temporal = templates.createRelational(o1, o2, "==");
                    this.info = templates.info;
                    break;

                case "^":
                    temporal = templates.createXor(o1, o2);
                    this.info = templates.info;
                    break;
            }

            return { return: temporal, type: resultType };
        }

        this.processUnaryOpt = function (operand, operator) {
            let resultType = validator.validateExpression(operand, null, operator);
            let o1 = operand.return;
            let tmp = this.info.createTemporal();
            switch (operator) {
                case "-":
                    this.info.add(`${tmp} = 0 - ${o1};`);
                    break;
                case "!":
                    this.info.add(`${tmp} = 1 - ${o1};`);
                    break;
            }
            return { return: tmp, type: resultType };
        }

        this.processExplicitCast = function (castNode) {
            let current = this;
            let castResult = null;
            castNode.ApplyAndGetData({
                "2": function (nodes) {
                    let typeNode = nodes[0];
                    let expNode = nodes[1];

                    let exp = current.processNode(expNode);

                    let typeName = typeNode.getValue();

                    // TODO realizar las comparaciones de valores
                    // char y int, con sus rangos y revisar si es permitido
                    // realizar el casteo

                    if (typeName == types.INT && exp.type == types.DBL) {
                        let resulttmp = current.info.createTemporal();
                        let decimaltmp = current.info.createTemporal();

                        current.info.add(`${decimaltmp} = ${exp.return} % 1;`);
                        current.info.add(`${resulttmp} = ${exp.return} - ${decimaltmp};`);

                        exp.return = resulttmp;
                        exp.type = types.INT;
                    }
                    else if (typeName == "char" && (exp.type == types.DBL || exp.type == types.INT)) {
                        let resulttmp = current.info.createTemporal();

                        if (exp.type == types.DBL) {
                            let decimaltmp = current.info.createTemporal();

                            current.info.add(`${decimaltmp} = ${exp.return} % 1;`);
                            current.info.add(`${resulttmp} = ${exp.return} - ${decimaltmp};`);
                        }

                        else {
                            current.info.add(`${resulttmp} = ${exp.return};`);

                        }

                        exp.return = resulttmp;
                        exp.type = types.CHR;
                    }
                    else if (typeName == "double" && (exp.type == types.INT || exp.type == types.CHAR)) {
                        exp.type = types.DBL;
                    }
                    else {
                        throw { msg: "Casteo explicito no valido de el tipo original [" + exp.type + "] al tipo [" + typeName + "].", node: expNode, token: 'Error al convertir tipos' };
                    }

                    castResult = exp;
                },
                sendAsArray: true
            });

            if (castResult) {
                return castResult;
            }

            throw { msg: "Cast invalido o no aceptado", node: castNode };
        }

        this.processString = function (value) {
            let pastK = this.info.getK();

            if (value == null) {
                this.info.heap("-1");
            }
            else {
                for (let i = 0; i < value.length; i++) {
                    let char = value.charCodeAt(i);

                    if (char == 92) {
                        if (value.charCodeAt(i + 1) == 110) {
                            this.info.heap(10);
                            i = i + 1;
                        }
                    }
                    else {
                        this.info.heap(char);
                    }
                }
                this.info.heap("0");
            }

            return { return: pastK, type: validator.OpTyp.STR };
        }

        this.processLiteral = function (expNode) {
            switch (expNode.getRawType().toLowerCase()) {
                case "integer":
                    return { return: expNode.getValue(), type: validator.OpTyp.INT };

                case "double":
                    return { return: expNode.getValue(), type: validator.OpTyp.DBL };

                case "string":
                    return this.processString(expNode.getRawValue());

                case "char":
                    let charcode = expNode.getValue().replace("'", "").charCodeAt(0);
                    return { return: charcode, type: validator.OpTyp.CHR };

                case "boolean":
                    let boolean = expNode.getValue().toLowerCase() === "true" ? 1 : 0;
                    return { return: boolean, type: validator.OpTyp.BOL };
            }
            return { return: "null", type: null };
        }

        this.processExp = function (expNode) {
            let count = expNode.getCount();
            let operator = "";

            switch (count) {

                case 1:
                    // revisar si es un acceso en vez de un literal
                    return this.processNode(expNode.getChild(0));

                case 2:
                    let first = expNode.getChild(0);
                    let second = expNode.getChild(1);
                    let operand = {};

                    if (second.getValue() == "++" || second.getValue() == "--") {
                        let last_value = this.processNode(first, { funct: this.info.data });
                        // validar que la ultima expresion sea correta
                        validator.validateExpression(last_value, null, second.getValue());

                        let name = first.getChild(0).getValue();

                        operator = second.getValue();

                        // buscar en la tabla de simbolos el simbolo
                        let possibleScopes = first.getChild(0).scope.getAllScopes();
                        let symbol = this.symtbl.searchScopedSymbol({
                            name: name,
                            role: this.symtbl.Roles.VAR
                        }, possibleScopes, expNode);

                        if (!symbol) {
                            throw { msg: `La variable ${name} no fue encontrada`, token: "La variable no existe en este contexto", node: expNode };
                        }

                        if (symbol.isGlobal) {
                            let relativePos = symbol.HeapShift;
                            let resultTmp = this.info.createTemporal();

                            this.info.add(`${resultTmp} = ${last_value.return} ${operator == "++" ? "+" : "-"} 1;`);
                            this.info.addToHeap(relativePos, resultTmp);
                        }
                        else {
                            let relativePos = this.info.getRelativePos(symbol.relative);
                            let resultTmp = this.info.createTemporal();

                            this.info.add(`${resultTmp} = ${last_value.return} ${operator == "++" ? "+" : "-"} 1;`);
                            this.info.addToStack(relativePos, resultTmp);
                        }

                        return last_value;
                    }
                    else {
                        operator = first.getValue();
                        operand = this.processNode(second, { funct: this.info.data });

                        return this.processUnaryOpt(operand, operator);
                    }


                case 3:
                    operator = expNode.getChild(1).getValue();
                    if (operator == "&&" || operator == "||") {
                        let operand1 = this.processNode(expNode.getChild(0), { funct: this.info.data });
                        let o1 = operand1.return;
                        let tRes = this.info.createTemporal();
                        let lNext = this.info.createLabel();

                        let tempResult = "";

                        let add = function (str) {
                            tempResult += str;
                        }

                        if (operator == "&&") {
                            add(`${tRes} = 0;\n`)
                            add(`if (${o1} == 0) goto ${lNext};\n`);
                        }
                        else {
                            add(`${tRes} = 1;\n`)
                            add(`if (${o1} == 1) goto ${lNext};\n`);
                        }

                        let operand2 = this.processNode(expNode.getChild(2), { funct: this.info.data });
                        let o2 = operand2.return;

                        if (operator == "&&") {
                            add(`if (${o2} == 0) goto ${lNext};\n`);
                            add(`${tRes} = 1;\n`)
                        }
                        else {
                            add(`if (${o2} == 1) goto ${lNext};\n`);
                            add(`${tRes} = 0;\n`)
                        }

                        add(`${lNext}:\n`);

                        let resultType = validator.validateExpression(operand1, operand2, operator);

                        if (resultType == types.BOL) {
                            this.info.add(tempResult);
                            return { return: tRes, type: resultType };
                        }
                        else {
                            console.log("Error, operacion logica sin operandos booleans");
                            return { return: 0, type: 0 };
                        }

                    }
                    else {
                        let operand1 = this.processNode(expNode.getChild(0), { funct: this.info.data });
                        let operand2 = this.processNode(expNode.getChild(2), { funct: this.info.data });
                        return this.processBinaryOpt(operand1, operator, operand2);
                    }
            }
        }

        this.processBlock = function (block, funct) {
            let current = this;
            block.runAndApply(function (node, carry) {
                var compilation = current.processNode(node, carry.info);
                if (compilation.accepted)
                    carry.skipNext = true;
                return carry;
            }, {
                procede: true,
                info: funct
            });
        }

        this.processAccess = function (accessNode) {
            let current = this;

            return accessNode.ApplyAndGetData({
                "0": function (node) {
                    let possibleScopes = accessNode.scope.getAllScopes();
                    let sym = current.symtbl.searchScopedSymbol({
                        name: node.getValue(),
                        role: current.symtbl.Roles.VAR
                    }, possibleScopes, accessNode);

                    if (!sym || !sym.name) {
                        throw { msg: `La variable ${node.getValue()} no existe en este ambito.`, node: accessNode, token: 'Referencia a variable indefinida' };
                    }

                    if (!sym.initialized) {
                        throw { msg: `La variable ${node.getValue()} no ha sido inicializada`, node: accessNode, token: "Referencia a variable no inicializada" };
                    }

                    let relative_pos;
                    let tmpResult;

                    if (sym.isGlobal) {
                        relative_pos = sym.HeapShift;
                        tmpResult = current.info.getFromHeap(relative_pos);
                    }
                    else {
                        relative_pos = current.info.getRelativePos(sym.relative);
                        tmpResult = current.info.getFromStack(relative_pos);
                    }

                    return { return: tmpResult, type: sym.type.val };
                },

                "1": function (node) {
                    return current.processNode(node, { funct: current.info.data });
                },


                "2": function (node) {
                    return current.processNode(node, { funct: current.info.data });
                }
            });
        }

        this.processImplicitCast = function (currentType, newType) {
            return (currentType == "char" && (newType == "integer" || newType == "double"))
                || (currentType == "integer" && (newType == "double"))
                || currentType == "var"
                || currentType == "global"
                || currentType == "const"
                ;
        }

        this.processDeclaration = function (decNode) {
            let current = this;

            let symbols = decNode.associatedSymbols;

            symbols.forEach(symbol => {

                let type = symbol.type;
                let exp = this.processExp(decNode.getChild(2));

                if (exp == undefined) {
                    if (type.name == "string") {
                        exp = this.processString(null);
                    }

                    exp = {
                        return: "0",
                        type: type.name
                    };
                }

                let isSpecialAssign = type.name != "var" && type.name != "const" && type.name == "global";
                let canCast = this.processImplicitCast(exp.type, type.name);

                if (type.name != exp.type && isSpecialAssign && !canCast) {
                    throw {
                        msg: `La expresion esperada es de tipo [${type.name}] pero se encontro una de tipo [${exp.type}]`,
                        token: "Error en el tipo de expresion",
                        node: decNode
                    }
                }

                // reasignar la variable y el simbolo
                if (isSpecialAssign) {
                    current.symtbl.update();
                }

                if (symbol.isGlobal) {
                    //guardar el valor en el heap
                    current.info.addToHeap(symbol.HeapShift, exp.return);
                }
                else {
                    let relativePos = current.info.getRelativePos(symbol.relative);
                    current.info.addToStack(relativePos, exp.return);
                }

                symbol.initialized = true;
            });
        }

        this.processAsignation = function (assignNode) {
            let current = this;
            return assignNode.ApplyAndGetData({
                "2": function (node) {

                    let name = node.getChild(0).getValue();
                    let possibleScopes = node.getChild(0).scope.getAllScopes();

                    // buscar en la tabla de simbolos el simbolo
                    let symbol = current.symtbl.searchScopedSymbol({
                        name: name,
                        role: current.symtbl.Roles.VAR
                    }, possibleScopes, assignNode);

                    if (!symbol) {
                        throw { msg: `La variable [${name}] no fue encontrada en este ambito ni ambitos padres`, token: "No se encontro la variable", node: node.getChild(0) };
                    }

                    if (!symbol.initialized) {
                        throw { msg: `La variable [${name}] no ha sido inicializada y no puede ser utilizada.`, token: "Variable no inicializada utilizada", node: node.getChild(0) };
                    }

                    if (symbol.isConst) {
                        throw { msg: `La variable [${name}] no puede ser modificada ya que es constante`, token: "Asignacion de constante", node: node.getChild(0) };
                    }

                    let expNode = node.getChild(1);
                    let exp = current.processNode(expNode, { funct: current.info.data });

                    if (!exp) {
                        throw { msg: "Error al compilar la expresion", token: "Error de compilacion de expresion", node: expNode };
                    }

                    if (exp.type != symbol.type.name) {
                        if (!current.processImplicitCast(exp.type, symbol.type.name)) {
                            throw { msg: `No se puede asignar a la variable ${name} de tipo ${symbol.type.name} un valor de tipo ${exp.type}` };
                        }
                    }

                    if (symbol.isGlobal) {
                        let heapPos = symbol.HeapShift;
                        current.info.addToHeap(heapPos, exp.return);
                    }
                    else {
                        let relativePos = current.info.getRelativePos(symbol.relative);
                        current.info.addToStack(relativePos, exp.return);
                    }

                    return { name: name, exp: exp };
                }
            })
        }

        this.processCases = function (swExp, cases, defaultNode) {
            let current = this;
            let labels = [];
            let pastBreakLabel = current.info.breakLabel;

            // Crear una etiqueta para realizar la comparacion del cada valor de los ifs
            let checkLabel = current.info.createLabel();
            let nextLabel = current.info.createLabel();

            current.info.breakLabel = nextLabel;

            // crear label
            let defaultLabel = defaultNode ? current.info.createLabel() : null;

            current.info.add(`goto ${checkLabel};`);

            cases.forEach(caze => {
                let block = caze.getChild(2);
                let currLabel = current.info.createLabel();
                labels.push(currLabel);
                current.info.add(`${currLabel}:`);
                current.processBlock(block);
            });

            if (defaultNode) {
                current.info.add(`${defaultLabel}:`);
                current.processBlock(defaultNode);
            }
            current.info.add(`goto ${nextLabel};`);

            current.info.add(`${checkLabel}:`);
            // realizar los ifs
            cases.forEach((caze, index) => {
                let expNode = caze.getChild(1);
                let expResult = current.processNode(expNode);
                let eqlResult = current.processBinaryOpt(swExp, "==", expResult);

                current.info.add(`if (${eqlResult.return} == 1) goto ${labels[index]};`);
            });

            if (defaultNode) {
                current.info.add(`goto ${defaultLabel};`);
            }

            current.info.add(`${nextLabel}:`);

            current.info.breakLabel = pastBreakLabel;
        }

        this.processSwitch = function (switchNode) {
            let current = this;

            switchNode.ApplyAndGetData({
                "3": function (nodes) {
                    let expNode = nodes[1];
                    let exp = current.processNode(expNode);
                    let switchBody = nodes[2];

                    switchBody.ApplyAndGetData({
                        "1": function (nodes) {
                            let case_list = nodes[0];
                            current.processCases(exp, case_list.childs);
                        },
                        "2": function (nodes) {
                            let case_list = nodes[0];
                            let default_node = nodes[1];

                            current.processCases(exp, case_list.childs, default_node);
                        },
                        sendAsArray: true
                    })
                },

                sendAsArray: true
            })

            return {};
        }

        this.processIf = function (node, trailLabel) {
            let current = this;
            node.ApplyAndGetData({
                "3": function (nodes) {
                    let expNode = nodes[1];
                    let block = nodes[2];

                    let expResult = current.processNode(expNode, { funct: current.info.data });

                    if (expResult.type != types.BOL) {
                        throw {
                            msg: `La expresion de un IF debe ser booleana, se encontro una de tipo [${expResult.type}]`,
                            token: "Problema en valor del if",
                            node: nodes[0]
                        };
                    }

                    let nextLabel = current.info.createLabel();

                    current.info.add(`if (${expResult.return} == 0) goto ${nextLabel};`);
                    current.processBlock(block, { funct: current.info.data });
                    if (trailLabel) {
                        current.info.add(`goto ${trailLabel};`);
                    }
                    current.info.add(`${nextLabel}:`);
                },

                sendAsArray: true
            });

            return {};
        }

        this.processIfElse = function (node) {
            let current = this;
            node.ApplyAndGetData({
                "2": function (nodes) {
                    // crear etiqueta a donde se ira el if, si es falso
                    let labelNext = current.info.createLabel();

                    // escribir el if
                    current.processIf(nodes[0], labelNext);

                    // obtener el bloque del else
                    let elseBlock = nodes[1].getChild(1);

                    // procesar el bloque del else
                    current.processBlock(elseBlock, { funct: current.info.data });

                    // escribir el label de salida del if
                    current.info.add(`${labelNext}:\n`);
                },

                sendAsArray: true,
            });

            return {};
        }

        this.processIfElseIf = function (node) {
            let current = this;
            node.ApplyAndGetData({
                "2": function (nodes) {
                    // crear etiqueta a donde se ira el if, si es falso
                    let labelNext = current.info.createLabel();

                    // escribir el if
                    current.processIf(nodes[0], labelNext);

                    // procesar los elseifs
                    let elseifs = nodes[1].childs;

                    elseifs.forEach(elseif => {
                        let ifnode = elseif.getChild(1);
                        current.processIf(ifnode, labelNext);
                    });

                    // escribir el label de salida del if
                    current.info.add(`${labelNext}:\n`);
                },

                sendAsArray: true
            });

            return {};
        }

        this.processIfElseIfElse = function (node) {
            let current = this;
            node.ApplyAndGetData({
                "3": function (nodes) {
                    // crear etiqueta a donde se ira el if, si es falso
                    let labelNext = current.info.createLabel();

                    // escribir el if
                    current.processIf(nodes[0], labelNext);

                    // procesar los elseifs
                    let elseifs = nodes[1].childs;

                    elseifs.forEach(elseif => {
                        let ifnode = elseif.getChild(1);
                        current.processIf(ifnode, labelNext);
                    });

                    // obtener el bloque del else
                    let elseBlock = nodes[2].getChild(1);

                    // procesar el bloque del else
                    current.processBlock(elseBlock, { funct: current.info.data });

                    // escribir el label de salida del if
                    current.info.add(`${labelNext}:\n`);
                },

                sendAsArray: true
            });

            return {};
        }

        this.processReturn = function (returnNode) {
            let current = this;
            let funct = this.info.data;
            return returnNode.ApplyAndGetData({
                "2": function (nodes) {
                    let expNode = nodes[1];

                    if (expNode) {
                        if (funct.type.name == types.VOI) {
                            throw { msg: "Una funcion [void] no puede tener un valor de retorno", token: "Las funciones void no tienen retorno", node: returnNode };
                        }

                        let result = current.processNode(expNode);

                        if (result.type != funct.type.name) {
                            throw { msg: `Una funcion de tipo [${current.type.name}] no puede retornar un tipo [${result.type.name}]`, token: "Error al convertir expresiones", node: expNode };
                        }

                        let returnPos = current.info.getRelativePos(funct.return_pos);
                        current.info.addToStack(returnPos, result.return);
                    }
                    else {
                        if (funct.type.name != types.VOI) {
                            throw { msg: `Una funcion de tipo [${funct.type.name}] debe tener un valor diferente a [void]`, token: "Error al retornar valor", node: returnNode };
                        }
                    }

                    current.info.add(`goto ${funct.return_label};`);

                    return {};
                },
                sendAsArray: true
            })
        }

        this.processMethodCall = function (methodNode) {
            let current = this;
            /*
            let hasSize = current.info.data.size > 0;
            let topIndex = 0;

            if (hasSize) {
                let startIndex = current.info.data.size;
                topIndex = startIndex;
                // guardar todos los temporales en el stack
                current.info.activationTmps.forEach((tmp, index) => {
                    let topStackPos = current.info.getRelativePosWithoutSave(topIndex++);
                    current.info.addToStack(topStackPos, tmp);
                });

                current.info.add(`P = P + ${topIndex};`);
            }
            */

            let result = methodNode.ApplyAndGetData({
                //basic method call, no parameters
                "1": function (nodes) {
                    let name = nodes[0].getValue();

                    let methodSymbol = current.symtbl.searchSymbol({
                        name: name,
                        params_name: ""
                    });

                    let tmp = current.info.call({
                        params: [],
                        name: methodSymbol.callable_name(),
                        return: methodSymbol.has_return(),
                        funct_info: methodSymbol
                    });
                    //console.log({ return: tmp, type: methodSymbol.type.val, isLiteral: false, accepted: true });
                    return { return: tmp, type: methodSymbol.type.val, isLiteral: false, accepted: true }
                },

                //method call, parameters
                "2": function (nodes) {
                    let name = nodes[0].getValue();
                    let paramsNode = nodes[1];
                    let tmp = null;
                    let methodSymbol = null;

                    if (paramsNode.withIds) {

                    }
                    else {
                        let paramsNum = paramsNode.getCount();
                        let params_call = "";
                        let params_val = [];

                        for (let i = 0; i < paramsNum; i++) {
                            let paramNodeExp = paramsNode.getChild(i);
                            let paramVal = current.processNode(paramNodeExp, { funct: current.info.data });
                            params_call += `_${paramVal.type}`;
                            paramVal.val = paramVal.return;
                            paramVal.relative = i;
                            params_val.push(paramVal);
                        }

                        methodSymbol = current.symtbl.searchSymbol({
                            name: name,
                            params_name: params_call.toLowerCase()
                        }, methodNode);
                        //console.log("Simbolo: ", methodSymbol);
                        tmp = current.info.call({
                            params: params_val,
                            name: methodSymbol.callable_name(),
                            return: methodSymbol.has_return(),
                            funct_info: methodSymbol
                        });
                    }

                    let methodType = methodSymbol.type.val
                    if (methodSymbol.type.val != "void") {
                        if (!tmp) {
                            throw { msg: `La llamada a la funcion [${name}] de tipo [${methodType}] no retornó ningún valor.`, token: "Llamada a funcion sin valor correcto", node: methodNode };
                        }
                    }
                    else if (tmp) {
                        throw { msg: `La llamada a la funcion [${name}] de tipo [${methodType}] no puede retornar ningun valor.`, token: "Llamada a funcion void retorno valor", node: methodNode }
                    }

                    return { return: tmp, type: methodSymbol.type.val, isLiteral: false, accepted: true }
                },

                sendAsArray: true
            });

            /*
            if (hasSize) {
                current.info.add(`P = P - ${topIndex};`);

                // guardar todos los temporales en el stack
                current.info.activationTmps.forEach(tmp => {
                    let topStackPos = current.info.getRelativePosWithoutSave(topIndex--);
                    current.info.add(`${tmp} = stack[${topStackPos}];`);
                });
            }
            */

            return result;
        }

        // nuevo
        this.processComposCall = function (cNode) {
            let current = this;
            let result = {};

            cNode.ApplyAndGetData({
                "2": function (nodes) {
                    let val = nodes[0];
                    let fn = nodes[1];
                    let tmpAccess;
                    if (val.type == "terminal") {
                        tmpAccess = current.processAccess(val);
                    }
                    else {
                        tmpAccess = current.processLiteral(val);
                    }

                    if (!tmpAccess || tmpAccess.type != "string") {
                        throw {
                            msg: `Las funciones nativas solo pueden ser aplicadas a [Strings] y [Arrays], se encontro una expresion de tipo [${tmpAccess ? tmpAccess.type : "[indefinido]"}]`,
                            token: `${val.getValue()}`,
                            node: fn
                        };
                    }

                    let fname = fn.getValue().toLowerCase();
                    let curr_res = null;
                    let tmp;
                    switch (fname) {
                        case "length":
                            tmp = current.info.call({
                                name: "__strlen__",
                                params: [{
                                    val: tmpAccess.return,
                                    type: tmpAccess.type,
                                    relative: 0
                                }],
                                return: true,

                                funct_info: {
                                    params: 1,
                                    size: 0,
                                    return: true,
                                    return_pos: 1,
                                    return_relative: true
                                }
                            });

                            result = { return: tmp, type: types.INT };
                        case "touppercase":
                            current.info.call({
                                name: "__upper__",
                                params: [{
                                    val: tmpAccess.return,
                                    type: tmpAccess.type,
                                    relative: 0
                                }],
                                return: false,

                                funct_info: {
                                    params: 1,
                                    size: 0,
                                    return: false,
                                    return_pos: -1,
                                    return_relative: false
                                }
                            });

                            result = tmpAccess;
                            break;
                        case "tolowercase":
                            current.info.call({
                                name: "__lower__",
                                params: [{
                                    val: tmpAccess.return,
                                    type: tmpAccess.type,
                                    relative: 0
                                }],
                                return: false,

                                funct_info: {
                                    params: 1,
                                    size: 0,
                                    return: false,
                                    return_pos: -1,
                                    return_relative: false
                                }
                            });

                            result = tmpAccess;
                            break;
                        default:
                            throw { msg: `La funcion nativa ${fname} aplicada al tipo de dato [String] no existe`, token: `${val.getValue()}`, node: fn };
                    }
                },
                sendAsArray: true
            })

            return result;
        }

        this.processPrint = function (printNode, breakLine) {
            let expChild = printNode.getChild(1);
            let r = this.processNode(expChild, { funct: this.info.data });

            switch (r.type) {

                case types.STR:
                    this.info.call({
                        params: [{
                            val: r.return,
                            relative: 0
                        }],

                        name: "__print__",
                        return: false
                    });
                    break;

                case types.INT:
                    this.info.add(`print("%i", ${r.return});`);
                    break;

                case types.DBL:
                    this.info.add(`print("%d", ${r.return});`);
                    break;

                case types.BOL:
                    this.info.call({
                        params: [{
                            val: r.return,
                            relative: 0
                        }],

                        name: "__print_boolean__",
                        return: false
                    });
                    break;

                case types.CHR:
                    this.info.add(`print("%c", ${r.return});`);
                    break;

                default:
                    break;
            }

            this.info.add(`print("%c", 10);`);
            return {};
        }

        this.processWhile = function (whileNode) {
            let current = this;

            whileNode.ApplyAndGetData({
                "2": function (nodes) {
                    let while_exp = nodes[0];
                    let exp = while_exp.getChild(1);
                    let block = nodes[1];
                    let labelCondition = current.info.createLabel();

                    current.info.add(`${labelCondition}:`);

                    let result = current.processNode(exp);
                    // revisar tipos
                    let nextLabel = current.info.createLabel();
                    let pastBreakLabel = current.info.breakLabel;
                    let pastContinueLabel = current.info.continueLabel;

                    current.info.breakLabel = nextLabel;
                    current.info.continueLabel = labelCondition;

                    current.info.add(`if (${result.return} == 0) goto ${nextLabel};`);
                    current.processBlock(block);
                    current.info.add(`goto ${labelCondition};`);
                    current.info.add(`${nextLabel}: `);

                    current.info.breakLabel = pastBreakLabel;
                    current.info.continueLabel = pastContinueLabel;
                },
                sendAsArray: true
            })

            return {};
        }

        this.processDoWhile = function (doWhileNode) {
            let current = this;

            doWhileNode.ApplyAndGetData({
                "3": function (nodes) {
                    let while_exp = nodes[2];
                    let exp = while_exp.getChild(1);

                    let block = nodes[1];
                    let repeatLabel = current.info.createLabel();
                    let labelCondition = current.info.createLabel();
                    let nextLabel = current.info.createLabel();

                    let pastBreakLabel = current.info.breakLabel;
                    let pastContinueLabel = current.info.continueLabel;

                    current.info.breakLabel = nextLabel;
                    current.info.continueLabel = labelCondition;

                    current.info.add(`${repeatLabel}:`);
                    current.processBlock(block);
                    current.info.add(`${labelCondition}:`);

                    let result = current.processNode(exp);

                    current.info.add(`if (${result.return} == 1) goto ${repeatLabel};`);
                    current.info.add(`${nextLabel}: `);

                    current.info.breakLabel = pastBreakLabel;
                    current.info.continueLabel = pastContinueLabel;
                },
                sendAsArray: true
            })

            return {};
        }

        this.processFor = function (forNode) {
            let current = this;

            forNode.ApplyAndGetData({
                "5": function (nodes) {

                    // obtener cada uno
                    let asgNode = nodes[1];
                    let expNode = nodes[2];
                    let finNode = nodes[3];
                    let blkNode = nodes[4];

                    // compilar asignacion
                    if (asgNode) {
                        current.processNode(asgNode);
                    }

                    // compilar expresion
                    let expLbl = current.info.createLabel();
                    // compilar el label de next
                    let nextLabel = current.info.createLabel();
                    let finLabel = current.info.createLabel();

                    current.info.add(`${expLbl}:`);

                    if (expNode) {
                        let exp = current.processExp(expNode);

                        // realizar check de la expresion
                        current.info.add(`if (${exp.return} == 0) goto ${nextLabel};`);
                    }

                    // guardar los labels actuales
                    let pastBreakLabel = current.info.breakLabel;
                    let pastContinueLabel = current.info.continueLabel;

                    current.info.breakLabel = nextLabel;
                    current.info.continueLabel = finLabel;

                    // compilar bloque
                    current.processBlock(blkNode);

                    // reasignar los labels pasados
                    current.info.breakLabel = pastBreakLabel;
                    current.info.continueLabel = pastContinueLabel;

                    current.info.add(`${finLabel}:`);
                    // realizar accion final
                    if (finNode) {
                        current.processNode(finNode);
                    }

                    current.info.add(`goto ${expLbl};`)

                    // escribir el label final
                    current.info.add(`${nextLabel}: `);
                },
                sendAsArray: true
            })

            return {};
        }

        this.processBreak = function (breakNode) {
            if (this.info.breakLabel) {
                this.info.add(`goto ${this.info.breakLabel};`);
            }
            else {
                throw { msg: "Break en una posicion incorrecta", token: "El break no es correcto en este lugar", node: breakNode };
            }

            return {};
        }

        this.processContinue = function (continueNode) {
            if (this.info.continueLabel) {
                this.info.add(`goto ${this.info.continueLabel};`);
            }
            else {
                throw { msg: "Continue en una posicion incorrecta", token: "El continue no es correcto en este lugar", node: continueNode };
            }

            return {};
        }

        this.processNode = function (node, info) {

            let nodeType = node.getType();
            let result = {};

            if (info)
                this.info.data = info.funct;

            switch (nodeType.toLowerCase()) {

                case "declaracion":
                    this.processDeclaration(node);
                    result.accepted = true;
                    break;

                case "asignacion":
                    this.processAsignation(node);
                    result.accepted = true;
                    break;

                case "e":
                    result = this.processExp(node);
                    result.accepted = true;
                    break;

                case "cast":
                    result = this.processExplicitCast(node);
                    result.accepted = true;
                    break;

                case "literal":
                    result = this.processLiteral(node.getChild(0));
                    result.isLiteral = true;
                    result.accepted = true;
                    break;

                case "acceso":
                    result = this.processAccess(node.getChild(0));
                    result.accepted = true;
                    break;

                case "print":
                    result = this.processPrint(node);
                    result.accepted = true;
                    break;

                case "call":
                    result = this.processMethodCall(node);
                    result.accepted = true;
                    break;

                //nuevo
                case "compos_call":
                    result = this.processComposCall(node);
                    result.accepted = true;
                    break;

                case "retornar":
                    result = this.processReturn(node);
                    result.accepted = true;
                    break;

                case "if":
                    result = this.processIf(node);
                    result.accepted = true;
                    break;

                case "if_else":
                    result = this.processIfElse(node);
                    result.accepted = true;
                    break;

                case "if_else_if":
                    result = this.processIfElseIf(node);
                    result.accepted = true;
                    break;

                case "if_else_if_else":
                    result = this.processIfElseIfElse(node);
                    result.accepted = true;
                    break;

                case "switch":
                    result = this.processSwitch(node);
                    result.accepted = true;
                    break;

                case "while":
                    result = this.processWhile(node);
                    result.accepted = true;
                    break;

                case "do_while":
                    result = this.processDoWhile(node);
                    result.accepted = true;
                    break;

                case "for":
                    result = this.processFor(node);
                    result.accepted = true;
                    break;

                case "break":
                    result = this.processBreak(node);
                    result.accepted = true;
                    break;

                case "continue":
                    result = this.processContinue(node);
                    result.accepted = true;
                    break;
            }

            return result;
        }

        this.getCode = function () {
            let temporal_list = "var t0";

            for (let i = 1; i <= this.info.temporals; i++) {
                temporal_list += ', t' + i;
                if (i % 10 == 0) {
                    temporal_list += "\n\t";
                }
            }

            temporal_list += ";\n";

            return this.info.resultCode.replace("%_incrusted_%", temporal_list) + `\nl0:\n\tcall __add_globals__;\n\tcall void_principal;`
        }
    }
}

let initial_code = `

# CODIGO AUTOGENERADO

var H = 0;
var P = 0;

var Stack[];
var Heap[];

# utilizado en __print__
var pos, char, null_check;

# utilizado en __print_boolean__
var pbool_pos, pbool_val; 

# utilizado en __get_int_length__
var gil_pos, gil_val, gil_size, gil_neg, gil_ret;

# utilizado en __convert_int_
var cint_pos, cint_val, cint_heap_start, 
    cint_val_size, cint_val_par, cint_siz_ret,
    lcint_alloc_hmem_p, cint_k_pos, cint_shift,
    cint_digit, cint_ascii_digit, cint_ret_pos, 
    cint_val_decimal, cint_neg;
	
# utilizado en __concat__
var kptr, cchar, concatResult, 
    secondConcatPos, concatResultPos;

# utilizado en __convert_bool__
var cbool_val, cbool_heap_start,
    cbool_pos, cbool_return;

# Utilizado en __convert_char_
var cchar_heap_start, cchar_pos, 
    cchar_return, cchar_val;

# utilizado en __convert_dbl__
var cd_decimal, cd_heap_decimal_start, 
    cd_heap_start, cd_heap_start_pos,
    cd_int, cd_point_heap_pos, cd_point_pos,
    cd_pos, cd_ret_pos, cd_val, cd_decimal_shift;

# utilizado en pow
var ppow_base_pos, ppow__base, pow_exp_pos, pow_exp,
    pow_val, pow_base_start, ppow_index, pow_ret_pos;

# utilizado en __compare_strings__
var cs_first_curr_char, cs_first_heap_pos, ccss_first_pos,
	cs_ret, cs_ret_pos, ccss_secnd_curr_char,
    cs_secnd_heap_pos, cs_secnd_pos;
    
# utilizado en __strlen__
var sssle_stack_pos, ssle_heap_pos, sle_length, 
    sle_curr_char;

# Utilizado en __upper__
var upp_curr_char, upp_heap_pos;


# Utilizado en __lower__
var llow_currr_char, llow_hheeap_poos;

goto l0;

proc __upper__ begin
	upp_heap_pos = stack[P];
	
	l40:
	upp_curr_char = heap[upp_heap_pos];
	if (upp_curr_char <= 0) goto l41;
	
	if (upp_curr_char < 97) goto l43;
	if (upp_curr_char > 132) goto l43;
	goto l42;
	
	l43:
	upp_heap_pos = upp_heap_pos + 1;
	goto l40;
	
	# restarle 32 para volverlo upcase
	l42:
	upp_curr_char = upp_curr_char - 32;
	heap[upp_heap_pos] = upp_curr_char;
	goto l43;	
		
	l41:
end

proc __lower__ begin
llow_hheeap_poos = stack[P];
	
	l44:
	llow_currr_char = heap[llow_hheeap_poos];
	if (llow_currr_char <= 0) goto l45;
	
	if (llow_currr_char < 65) goto l46;
	if (llow_currr_char > 90) goto l46;
	goto l47;
	
	l46:
	llow_hheeap_poos = llow_hheeap_poos + 1;
	goto l44;
	
	# sumarle 32 para volverlo lowcase
	l47:
	llow_currr_char = llow_currr_char + 32;
	heap[llow_hheeap_poos] = llow_currr_char;
	goto l46;	
		
	l45:
end

proc __print__ begin
    pos = stack[P];
    
    l1:
        char = heap[pos];
        null_check = 0 - 1;
        if (char == null_check) goto l37;
            
        if (char == 0) goto l2;
        
        print("%c", char);
        pos = pos + 1;
        goto l1;
        
    l37:
        print("%c", 110);
        print("%c", 117);
        print("%c", 108);
        print("%c", 108);
    l2:
end

proc __print_boolean__ begin
    pbool_pos = P + 0;
    pbool_val = stack[pbool_pos];

    if (pbool_val == 1) goto l3;
    goto l4;

    l3:
        print("%c", 116);
        print("%c", 114);
        print("%c", 117);
        print("%c", 101);
        goto l5;

    l4:
        print("%c", 102);
        print("%c", 97);
        print("%c", 108);
        print("%c", 115);
        print("%c", 101);
    l5:
end

proc __get_int_length__ begin
    gil_pos = P + 0;
    gil_val = stack[gil_pos];
    gil_size = 0;
    
    if (gil_val < 0) goto l6;
    goto l7;
    
    l6:
    gil_neg = 0 - 1;
    gil_val = gil_val * gil_neg;
    
    l7:
    if (gil_val < 10) goto l8;
    
    gil_val = gil_val / 10;
    gil_size = gil_size + 1;
    
    goto l7;
    
    l8:
    gil_size = gil_size + 1;
    
    gil_ret = P + 1;
    stack[gil_ret] = gil_size;
end

proc __convert_int__ begin
    cint_pos = P + 0;
    cint_val = stack[cint_pos];
    cint_heap_start = H;

    cint_val_size = 0;
    
    P = P + 2;
    
    cint_val_par = P;
    
    stack[cint_val_par] = cint_val;
    
    call __get_int_length__;
    
    cint_siz_ret = P + 1;
    
    cint_val_size = stack[cint_siz_ret];
    P = P - 2;
    
    if (cint_val < 0) goto l9;
    goto l10;
    
    l9:
    cint_neg = 0 - 1;
    cint_val = cint_val * cint_neg;
    heap[H] = 45;
    H = H + 1;
    
    l10:
    lcint_alloc_hmem_p = 0;
    
    
    l11:
    
    if (lcint_alloc_hmem_p > cint_val_size) goto l12;
    
    cint_k_pos = H + lcint_alloc_hmem_p;
    
    heap[cint_k_pos] = 0;
    
    lcint_alloc_hmem_p = lcint_alloc_hmem_p + 1;

    goto l11;
    
    l12:
    
    
    cint_shift = cint_val_size - 1;
    
    
    l14:
    
    if (cint_val < 10) goto l13;
    
    cint_digit = cint_val % 10;
    
    cint_ascii_digit = cint_digit + 48;
    
    cint_k_pos = H + cint_shift;
    
    cint_shift = cint_shift - 1; 
    
    heap[cint_k_pos] = cint_ascii_digit;

    cint_val = cint_val / 10;

    cint_val_decimal = cint_val % 1;

    cint_val = cint_val - cint_val_decimal;

    goto l14;
    
    l13:
    
    cint_ascii_digit = cint_val + 48;
    
    cint_pos = H;
    
    heap[cint_pos] = cint_ascii_digit;
    
    H = H + cint_val_size;
    
    heap[H] = 0;
    
    H = H + 1;
    cint_ret_pos = P + 1;
    stack[cint_ret_pos] = cint_heap_start;
end

proc __convert_bool__ begin
    cbool_pos = P + 0;
    cbool_val = stack[cbool_pos];
    cbool_heap_start = H;

    if (cbool_val == 1) goto l19;
    goto l21;
    
    l19:
    heap[H] = 116;
    H = H + 1;
    heap[H] = 114;
    H = H + 1;
    heap[H] = 117;
    H = H + 1;
    heap[H] = 101;
    H = H + 1;
    goto l20;
    
    l21:
    heap[H] = 102;
    H = H + 1;
    heap[H] = 97;
    H = H + 1;
    heap[H] = 108;
    H = H + 1;
    heap[H] = 115;
    H = H + 1;
    heap[H] = 101;
    H = H + 1;
    
    l20:
    heap[H] = 0;
    H = H + 1;
    
    cbool_return = P + 1;
    stack[cbool_return] = cbool_heap_start;
end

proc __convert_char__ begin
    cchar_pos = P + 0;
    cchar_val = stack[cchar_pos];
    
    cchar_heap_start = H;
    
    heap[H] = cchar_val;
    H = H + 1;
    heap[H] = 0;
    H = H + 1;
    
    cchar_return = P + 1;
    stack[cchar_return] = cchar_heap_start;
end

proc __convert_dbl__ begin
    cd_pos = P + 0;
    cd_val = stack[cd_pos];
    
    cd_decimal = cd_val % 1;
    cd_int = cd_val - cd_decimal;
    
    # convertir primera parte
    P = P + 1;
    stack[P] = cd_int;
    call __convert_int__;
    cd_heap_start_pos = P + 1;
    cd_heap_start = stack[cd_heap_start_pos];
    P = P - 1;

    # agregar el punto
    cd_point_heap_pos = H;
    heap[H] = 46;
    H = H + 1;
    heap[H] = 0;
    H = H + 1;

    # concatenar parte entera con el punto
    P = P + 1;
    stack[P] = cd_heap_start;
    cd_point_pos = P + 1;
    stack[cd_point_pos] = cd_point_heap_pos;
    call __concat__;
    cd_heap_start_pos = P + 2;
    cd_heap_start = stack[cd_heap_start_pos];
    P = P - 1;
	
	# convertir parte decimal
    cd_decimal = cd_decimal * 1000000;
    cd_decimal_shift = cd_decimal % 1;
    cd_decimal = cd_decimal - cd_decimal_shift;
    
    P = P + 1;
    stack[P] = cd_decimal;
    call __convert_int__;
    cd_heap_start_pos = P + 1;
    cd_heap_decimal_start = stack[cd_heap_start_pos];
    P = P - 1;
	
    # concatenar todas las partes
    P = P + 1;
    stack[P] = cd_heap_start;
    cd_point_pos = P + 1;
    stack[cd_point_pos] = cd_heap_decimal_start;
    call __concat__;
    cd_heap_start_pos = P + 2;
    cd_heap_start = stack[cd_heap_start_pos];
    P = P - 1;
    
    # retornar el valor con punto
    cd_ret_pos = P + 1;
    stack[cd_ret_pos] = cd_heap_start;
    
end

proc __concat__ begin
    
    kptr = stack[P];
    concatResult = H;
    
    l15:
        
    cchar = heap[kptr];
    if (cchar == 0) goto l16;
    
    heap[H] = cchar;
    H = H + 1;
    
    kptr = kptr + 1;
    goto l15;
    
    l16:
    
    secondConcatPos = P + 1;
    kptr = stack[secondConcatPos];
    
    l17:
    cchar = heap[kptr];
    
    if (cchar == 0) goto l18;
    heap[H] = cchar;
    H = H + 1;
    kptr = kptr + 1;
    
    goto l17;
    
    l18:
    concatResultPos = P + 2;
    stack[concatResultPos] = concatResult; 
    
    heap[H] = 0;
    H = H + 1;
end

proc __pow__ begin
	# obtener base de la potencia
	ppow_base_pos = P + 0;
	ppow__base = stack[ppow_base_pos];
	
	# obtener exponente de la potencia
	pow_exp_pos = P + 1;
	pow_exp = stack[pow_exp_pos];
	
	pow_val = 1;
	
	# validar, si la potencia es menor que 0, levantar error
	if (pow_exp < 0) goto l31;
	# call __power_negative_error__;
	
	ppow_index = 0;
	
	# multiplicar cada iteracion
	l30:
    if(ppow_index == pow_exp) goto l31;
    pow_val = pow_val * ppow__base;
    ppow_index = ppow_index + 1;
    goto l30;

	# devolver valor en la posicion de retorno
	l31:
	pow_ret_pos = P + 2;
	stack[pow_ret_pos] = pow_val;
end

proc __compare_strings__ begin
	
	# obtener primer string
	ccss_first_pos = P + 0;
	cs_first_heap_pos = stack[ccss_first_pos];
	
	# obtener segundo string
	cs_secnd_pos = P + 1;
	cs_secnd_heap_pos = stack[cs_secnd_pos];
	
	# iniciar comparacion
	cs_first_curr_char = heap[cs_first_heap_pos];
	ccss_secnd_curr_char = heap[cs_secnd_heap_pos];
	
	# inicializar valor de retorno
	cs_ret = 1;
	
	# revisar si ambos son cero, retornar verdadero
	
	
	# revisar hasta que no sean 0
	l32:
	# si alguno de ambos es 0, ya no hay nada que comparar, retornar
	if (cs_first_curr_char == 0) goto l33;
	if (ccss_secnd_curr_char == 0) goto l34; 
	
	# los valores son diferentes, volver el retorno falso
	if (cs_first_curr_char <> ccss_secnd_curr_char) goto l35;
	
	# incrementar las posiciones del heap
	cs_first_heap_pos = cs_first_heap_pos + 1;
	cs_secnd_heap_pos = cs_secnd_heap_pos + 1;
	
	# obtener los caracteres de la posicion actual y volver a comparar
	cs_first_curr_char = heap[cs_first_heap_pos];
	ccss_secnd_curr_char = heap[cs_secnd_heap_pos];
	
	goto l32;
	
	# el primer string llego a su fin
	l33:
	# si el segundo aun no ha llegado a su fin, volver el retorno falso
	if (ccss_secnd_curr_char <> 0) goto l35;
	# el segundo valor tambien llego a su fin, devolver true
	goto l36;
	
	# el segundo string llego a su fin
	l34:
	# si el primero aun no ha llegado a su fin, volver el retorno falso
	if (cs_first_curr_char <> 0) goto l35;
	# el primer valor tambien llego a su fin, devolver true
	goto l36;
	
	
	# los valores no son iguales
	l35:
	cs_ret = 0;
	
	# retornar el valor de retorno actual
	l36:
	cs_ret_pos = P + 2;
	stack[cs_ret_pos] = cs_ret;
end

proc __strlen__ begin
	sssle_stack_pos = P + 0;
	ssle_heap_pos = stack[sssle_stack_pos];
	
	sle_length = 0;
	# iterar hasta que la posicion sea 0
	l38:
	sle_curr_char = heap[ssle_heap_pos];
	if (sle_curr_char <= 0) goto l39;
	sle_length = sle_length + 1;
	ssle_heap_pos = ssle_heap_pos + 1;
	goto l38;
	
	l39:
	sssle_stack_pos = P + 1;
	stack[sssle_stack_pos] = sle_length;
end

# CODIGO PROGRAMA

# cambiar el valor del heap para guardar todos los datos globales

%_incrusted_%
`;


exports.Conversor = C3DConversor;