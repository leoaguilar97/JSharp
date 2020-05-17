
const c3d = require("./C3DConversor/C3D");

let Roles = {
    FUNCTION: "FUNCION",
    PROPERTY: "PROPIEDAD",
    VAR: "VARIABLE",
    NONE: 4
};

let OpTyp = {
    "integer": "integer",
    "double": "double",
    "char": "char",
    "string": "string",
    "boolean": "boolean",
    "void": "void",
    "var": "var",
    "const": "const",
    "global": "global",
    "none": -1
};

class ScopeTree {
    constructor(id, parent) {
        this.parent = parent || null;
        this.id = id || -1;
    }

    static id = 1;

    static add(parent) {
        let newNode = new ScopeTree(ScopeTree.id++, parent);
        return newNode;
    }

    getAllScopes() {
        let scopes = [this.id];
        for (let current = this.parent; current != null; current = current.parent) {
            scopes.push(current.id);
        }

        return scopes;
    }
}

class SymTbl {

    getJsonable() {
        let result = [];
        this.symbols.forEach(sym => {
            result.push(sym.getJsonable());
        });

        return result;
    }

    update(symbol, searchCriteria, c3dUpdate) {
        searchCriteria.doNotThrow = true;
        let sym = this.searchSymbol(searchCriteria);

        if (sym == null) {
            if (c3dUpdate && (symbol.name != "P" && symbol.name != "K")) {
                let array_val = [];
                array_val[c3dUpdate.index] = symbol.val;
                symbol.val = array_val;
            }
            this.add(symbol, {});
        }
        else {
            if (c3dUpdate) {

                let current_stack_frame = c3dUpdate.index || 0;
                if (current_stack_frame >= 0)
                    this.symbols[sym.index].insertVal(current_stack_frame, symbol.val);
                else if (current_stack_frame == -1)
                    this.symbols[sym.index].insertVal(0, symbol.val);
                else
                    throw { msg: "Valor de actualizacion de variable invalido", symbol: symbol, criteria: searchCriteria }
                return;
                //return updatec3d(symbol, sym);
            }
            this.symbols[sym.index] = new Symbol(symbol);
        }
    }

    add(symbol, node) {

        let isFunct = symbol.role == Roles.FUNCTION;
        //buscar a ver si el simbolo ya existe
        let callable = "";

        if (isFunct) {
            let params_name = "";
            let params = symbol.params;

            params.forEach((param) => {
                params_name += `_${param.type.toLowerCase()}`;
            });

            params_name = params_name;
            callable = `${symbol.type.name}_${symbol.name}${params_name}`
        }

        let check = isFunct ? { "callable": callable } : { "name": symbol.name };

        check.parent_scope_id = this.currentScope().id;
        check.doNotThrow = true;
        // revisar unicamente en el ambito actual
        let symbolCheck = this.searchSymbol(check);

        if (symbolCheck) {
            throw { msg: `El simbolo [${isFunct ? check.callable : check.name}] fue declarado con anterioridad`, token: "Simbolo redefinido en el mismo ambito", node: node };
        }

        let symbolized = new Symbol(symbol);
        this.symbols.push(symbolized);

        return symbolized;
    }

    // Obtener el tipo del valor
    getType(typeNode) {
        return typeNode.ApplyAndGetData({
            "0": function (node) {
                let typeName = node.getValue();
                let typeVal = OpTyp[typeName.toLowerCase()];

                if (!typeVal) {
                    throw { msg: "No se encontro el tipo de variable <" + typeName + ">", node: node };
                }

                return { val: typeVal.toLowerCase(), name: typeName.toLowerCase(), dims: 0 };
            }
        });
    }

    processParams(paramsNode) {
        let params = [];
        let paramsNum = paramsNode.getCount();

        for (let i = 0; i < paramsNum; i++) {
            let paramNode = paramsNode.getChild(i);

            params.push({
                type: paramNode.getChild(0).getValue(),
                name: paramNode.getChild(1).getValue(),
                typeNode: paramNode.getChild(0),
                nameNode: paramNode.getChild(1),
            });
        }

        return params;
    }

    addFunction(methodNode) {
        let parent_scope = this.currentScope();

        let type = this.getType(methodNode.getChild(0));
        let name = methodNode.getChild(1);
        let params = this.processParams(methodNode.getChild(2));
        let body = methodNode.getChild(3);

        this.relativePos = 0;
        this.methodSize = 0;

        let generatedScope = this.createScope();
        methodNode.getChild(3).doNotCreateScope = true;

        this.methodSymbol = {
            name: name.getValue(),
            params: params,
            type: type,
            scope: generatedScope,
            scope_id: generatedScope.id,
            parent_scope: parent_scope,
            parent_scope_id: parent_scope.id,
            role: Roles.FUNCTION,
            body: body,
            size: 0,
            paramsShift: 0
        };
    }

    getVarName(varNameNode) {
        //console.log(varNameNode);
        return varNameNode.ApplyAndGetData({
            "3": function (nodes) {
                let name = nodes[0].getValue();

                return { name: name };
            },

            "0": function (nodes) {
                return { name: varNameNode.getValue() };
            },

            sendAsArray: true
        })
    }

    addVar(varNode) {
        let current = this;
        varNode.ApplyAndGetData({
            "3": function (nodes) {
                if (current.methodSize) {
                    current.methodSize++;
                }

                let type = current.getType(nodes[0]);
                let names = nodes[1];

                names.forEach((name) => {
                    let relativePos = current.relativePos++;

                    let isGlobal = (!current.methodSymbol || type.name == "global");

                    let name_symbol = {
                        type: type,
                        scope: -1,
                        name: name.getValue(),
                        parent_scope: isGlobal ? current.globalScope : current.currentScope(),
                        role: Roles.VAR,
                        parent_funct: isGlobal ? null : current.methodSymbol,
                        relative: relativePos,
                        body: varNode,
                        isGlobal: isGlobal,
                        isConst: type.name == "const",
                        initialized: false
                    };

                    if (name_symbol.isGlobal) {
                        name_symbol.HeapShift = current.HeapShift++;
                    }

                    if (type.name == "var" || type.name == "const" || type.name == "global"){
                        let expCompiler = new c3d.Conversor(this);
                        let expResult = expCompiler.processExp(nodes[2]);
                        let type = expResult.type;

                        name_symbol.type = {
                            val: type.toLowerCase(),
                            name: type.toLowerCase(),
                            dims: 0
                        };

                    }

                    let newSymbol = current.add(name_symbol, varNode);

                    varNode.associatedSymbols.push(newSymbol);

                    if (current.methodSymbol) {
                        current.methodSymbol.size++;
                    }
                });
            },

            "2": function (nodes) {

                let relativePos = current.relativePos++;

                let type = current.getType(nodes[0]);
                let name = nodes[1];

                let name_symbol = {
                    type: type,
                    scope: -1,
                    name: name.getValue(),
                    parent_scope: current.currentScope(),
                    role: Roles.VAR,
                    parent_funct: current.methodSymbol ? current.methodSymbol.name : null,
                    relative: relativePos,
                    body: varNode,
                    isGlobal: current.methodSymbol ? false : true,
                    initialized: true
                };

                current.add(name_symbol, varNode);
                varNode.associatedSymbols.push(name_symbol);

                if (current.methodSymbol) {
                    current.methodSymbol.size++;
                }
            },
            sendAsArray: true
        })
    }

    // agregar un simbolo a la tabla
    // aca se agregan todos los diferentes tipos de simbolos
    addSymbol(node) {

        switch (node.getType()) {

            case "funcion":
                this.addFunction(node);
                break;

            case "declaracion":
                this.addVar(node);
                break;

            case "parametro":
                this.addVar(node);
                this.methodSymbol.paramsShift++;
                break;

            case "terminal":
                node.scope = this.currentScope();
                break;

            case "ambiente":
                if (!node.doNotCreateScope)
                    this.createScope();
                break;

            case "for":
                this.createScope();
                break;


        }
    }

    // Si el nodo actual necesita generar un nuevo ambiente
    // para guardar la tabla de simbolos correctamente
    check_create_environment(node) {
        return node.getType() == "ambiente" || node.getType() == "for";
    }

    // Revisar la finalizacion del analisis del nodo
    finish_create_environment_and_result(node) {
        let node_type = node.getType();

        this.removeScope();

        // Si estoy revisando una funcion
        // sacar el ambito que se creo por analizarla
        // y agregar a la tabla de simbolos el return 
        // que es la ultima posicion en la tabla de simbolos
        if ((node_type == "funcion" || node.isFromFunct) && this.methodSymbol) {
            let type = this.methodSymbol.type;

            if (type && type.name != 'void') {
                this.methodSymbol.return_pos = ++this.methodSymbol.size;
                this.add({
                    name: "return",
                    type: type,
                    scope: -1,
                    parent_scope: this.methodSymbol.scope,
                    role: 'VARIABLE',
                    parent_funct: this.methodSymbol ? this.methodSymbol.name : "NA",
                    relative: this.size++,
                    parent_class: this.methodSymbol.parent_class
                }, node);
            }

            this.add(this.methodSymbol, node);

            node.associatedSymbols = [this.methodSymbol];
        }
    }

    // obtiene el ambito en el cual se encuentra
    // el nodo que se esta analizando
    currentScope() {
        let current = this.scopes[this.scopes.length - 1];
        return current;
    }

    // agrega un nuevo ambito a la lista de ambitos que existen
    createScope() {
        let current = this.currentScope();
        let newScope = ScopeTree.add(current);

        this.scopes.push(newScope);

        return newScope;
    }

    // remueve el ambito que se agrega
    removeScope() {
        if (this.scopes.length > 0) {
            let currentScope = this.scopes.pop();
            return currentScope;
        }
    }


    print() {
        console.log("TABLA DE SIMBOLOS");
        console.table(this.symbols);
    }

    // obtiene un o varios simbolos que cumplan un criterio especifico
    filter(criteria) {
        let found = [];

        this.symbols.forEach((symbol) => {
            let coincidence = true;
            for (var key in criteria) {
                let prop = symbol[key];
                let isCoincidence = prop != undefined && prop != null && prop === criteria[key];
                coincidence = coincidence && isCoincidence;
            }

            if (coincidence)
                found.push(symbol);
        });

        return found;
    }

    searchScopedSymbol(searchItem, possibleScopes, node) {
        let found = null;
        searchItem.doNotThrow = true;
        for (let i = 0; i < possibleScopes.length; i++) {
            searchItem.parent_scope_id = possibleScopes[i];
            found = this.searchSymbol(searchItem, node);
            if (found != null) {
                break;
            }
        }

        return found;
    }

    searchSymbol(searchItem, node) {
        let found = null;
        let i;
        for (i = 0; i < this.symbols.length; i++) {

            let sym = this.symbols[i];
            if (!sym) { continue; }

            let coincidence = true;
            for (var key in searchItem) {

                if (key === "doNotThrow") continue;

                let prop = sym[key];
                let isCoincidence = prop != undefined && prop != null && prop === searchItem[key];
                coincidence = coincidence && isCoincidence;
            }

            if (coincidence) {
                found = sym;
                break;
            }
        }

        if (found === null && !searchItem.doNotThrow) {
            console.table(searchItem);
            throw { msg: `El simbolo ${searchItem.name || searchItem.callable} no fue encontrado en el ambito actual`, token: `${searchItem.name || searchItem.callable}`, node: node};
        }

        if (found != null) {
            found.index = i;
        }

        return found;
    }

    // Iniciar compilacion 
    startCompiling() {
        let current = this;
        let compiler = new c3d.Conversor(this);

        let add = function (code) {
            compiler.info.add(code);
        }

        let functs = current.filter({ role: 'FUNCION' });
        let globals = current.filter({ role: Roles.VAR, isGlobal: true });

        add(heapAsignCode);
        if (globals.length > 0) {
            add(`H = H + ${this.HeapShift};`)
        }
        globals.forEach((global) => {
            compiler.processNode(global.body);
        });
        add(`end\n`);

        // compilar cada funcion
        functs.forEach((funct) => {
            let body = funct.body;

            let functName = funct.callable_name();
            compiler.info.add(`\nproc ${functName} begin`);
            compiler.info.activationTmps = [];

            //obtener parametros
            for (let i = funct.paramsShift; i < funct.size; i++) {
                let tmp = compiler.info.getRelativePos(i);
                compiler.info.addToStack(tmp, 0);
            }

            // etiqueta de retorno de la funcion
            // servira para los returns
            funct.return_label = compiler.info.createLabel();

            // compilar el codigo de la funcion
            body.runAndApply(function (node, carry) {
                var compilation = compiler.processNode(node, carry.info);
                if (compilation.accepted)
                    carry.skipNext = true;
                return carry;
            }, {
                procede: true,
                info: {
                    funct: funct
                }
            });

            add(`${funct.return_label}:`);
            add("end\n");
        });

        return compiler.getCode();
    }

    // constructor de la tabla de simbolos
    constructor() {
        this.symbols = [];
        this.globalScope = ScopeTree.add(null);
        this.scopes = [this.globalScope];
        this.Roles = Roles;
        this.HeapShift = 0;
    }
}

class Symbol {
    constructor(symbol) {
        this.name = symbol.name || "INDEFINIDO";
        this.type = symbol.type || "NA";
        this.scope = symbol.scope || null;
        this.scope_id = symbol.scope ? symbol.scope.id : -1;
        this.role = symbol.role || Roles.NONE;
        this.custom = symbol.custom || {};
        this.modifiers = symbol.modifiers || [];
        this.val = symbol.val || 0;
        this.parent_scope = symbol.parent_scope || null;
        this.parent_scope_id = symbol.parent_scope ? symbol.parent_scope.id : -1;
        this.parent_class = symbol.parent_class || "NA";
        this.parent_funct = symbol.parent_funct || "NA";
        this.body = symbol.body || 0;
        this.size = symbol.size || 1;
        this.relative = symbol.relative || 0;
        this.return_pos = symbol.return_pos;
        this.return_label = symbol.return_label || "";
        this.params = symbol.params || [];
        this.paramsShift = symbol.paramsShift || 0;
        this.isGlobal = symbol.parent_funct ? false : true;
        this.HeapShift = symbol.HeapShift || 0;
        this.isConst = symbol.isConst || false;
        this.initialized = symbol.initialized;

        let params_name = "";

        this.params.forEach((param) => {
            params_name += `_${param.type.toLowerCase()}`;
        });

        this.params_name = params_name;
        this.callable = `${this.type.name}_${this.name}${params_name}`
    }

    callable_name() {
        return this.callable;
    }

    has_return() {
        //console.log(this.type);
        return this.type.name != OpTyp.void;
    }

    getVal(index) {
        if (this.name.toLowerCase() === "p" || this.name.toLowerCase() === "k") {
            //console.log("Get", this.name, this.val);
            return this.val;
        }

        return this.val[index];
    }

    insertVal(index, val) {
        if (this.name.toLowerCase() === "p" || this.name.toLowerCase() === "k") {
            //console.log("Insert", this.name, this.val);
            this.val = val;
            return;
        }

        //console.log("Agregando al indice", index);
        //console.log("Tamano de indice", this.val.index);

        for (let i = this.val.index; i <= index; i++)
            this.push(0);

        this.val[index] = val;
    }

    getJsonable() {
        return {
            "name": this.name,
            "type": this.type,
            "role": this.role,
            "posicion": this.role == Roles.FUNCTION ? "NA" : this.relative,
            "tamano": this.size
        };
    }
}

exports.SymTbl = SymTbl;

let heapAsignCode =
    `
# Agregar todos los valores al heap
proc __add_globals__ begin`
    ;