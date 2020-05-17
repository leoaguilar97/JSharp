
let labels = [];

let inverseOps = {
    "==": "<>",
    "<>": "==",
    ">=": "<",
    ">": "<=",
    "<=": ">",
    "<": ">="
};

function getReverseOperator(operator) {
    return inverseOps[operator] || operator;
}

function getIds(idArray) {
    let result = "";
    if (idArray.length > 0) {
        result = idArray[0];

        if (idArray.length > 1) {
            for (let i = 1; i < idArray.length; i++) {
                result += ", " + idArray[i];
                if (i % 5 == 0) {
                    result += "\n\t";
                }
            }
        }
    }

    return result;
}

function value(node) {
    if (node.getType().toLowerCase() == "id") {
        return {
            value: node.getValue().toLowerCase(),
            type: "tmp",
            isCero: false,
            isOne: false,
            isTwo: false
        }
    }
    let numVal = node.getValue().toLowerCase() * 1;
    return {
        value: numVal,
        isCero: numVal == 0,
        isOne: numVal == 1,
        isTwo: numVal == 2,
        type: "num"
    };
}

function expp(node) {
    let type = node.getType().toLowerCase();
    let result = {
        val1: null,
        val2: null,
        operator: null,
        reverseOperator: null,
        isNum1: false,
        isNum2: false,
        has3: false,
        val: null
    };

    switch (type) {
        case "e":
            node.ApplyAndGetData({
                "1": function (nodes) {
                    result.val1 = value(nodes[0]);
                    result.isNum1 = result.val1.type == "num";
                },
                "2": function (nodes) {
                    result.operator = "u";
                    result.val1 = value(nodes[1]);
                    result.isNum1 = result.val1.type == "num";
                },
                "3": function (nodes) {
                    result.val1 = value(nodes[0]);
                    result.operator = nodes[1].getValue().toLowerCase().trim();
                    result.reverseOperator = getReverseOperator(result.operator);
                    result.val2 = value(nodes[2]);

                    result.isNum1 = result.val1.type == "num";
                    result.isNum2 = result.val2.type == "num";
                    result.has3 = true;

                    if (result.isNum1 && result.isNum2) {
                        result.val = eval(`${result.val1.value} ${result.operator == "<>" ? "!=" : result.operator} ${result.val2.value}`);
                        if (typeof result.val !== "boolean"){
                            result.val = null;
                        }
                    }
                },
                sendAsArray: true
            });

            result.type = "exp";
            break;

        case "stackpop":
            result.val1 = value(node.getChild(0));
            result.type = "stackpop";
            break;

        case "heappop":
            result.type = "heappop";
            result.val1 = value(node.getChild(0));
            break;
    }

    result.str = function () {
        if (this.type == "exp") {
            if (this.operator) {
                if (this.val2) {
                    return `${this.val1.value} ${this.operator} ${this.val2.value}`;
                }
                else {
                    return `- ${this.val1.value}`;
                }
            }
            else {
                return `${this.val1.value}`;
            }
        }
        else if (this.type == "stackpop") {
            return `Stack [ ${this.val1.value} ]`;
        }
        else if (this.type == "heappop") {
            return `Heap [ ${this.val1.value} ]`;
        }


        return `# error`;
    }

    return result;
}

function label(node) {
    let value = node.getChild(0).getValue();

    let label = { type: "label", value: value.toLowerCase() };
    labels.push(label);

    label.str = function () {
        return `${this.value} : `;
    }

    return label;
}

function gotoo(node) {
    let value = node.getChild(1).getValue().toLowerCase();

    let gotov = { type: "goto", value: value, reference: value, invis: true };
    gotov.str = function () {
        return `goto ${this.value} ;`
    }

    return gotov;
}

function ifz(node) {
    let exp = expp(node.getChild(1));
    let lbl = node.getChild(2).getValue().toLowerCase();

    let ifzv = { type: "if", value: { exp: exp, lbl: lbl }, reference: lbl, invis: false };

    ifzv.str = function () {
        return `if ( ${this.value.exp.str()} ) goto ${this.value.lbl} ;`;
    }

    return ifzv;
}

function printt(node) {
    let format = node.getChild(1).getValue().toLowerCase();
    let exp = expp(node.getChild(2));

    let printt = { type: "print", value: { format: format, exp: exp } };
    printt.str = function () {
        return `print( "${format}", ${exp.str()} );`;
    };

    return printt;
}

function method(node) {
    let name = node.getChild(1).getValue();

    let proc = { type: "proc", value: name.toLowerCase() };

    proc.str = function () {
        return `proc ${this.value} begin`;
    };

    return proc;
}

function caall(node) {
    let id = node.getChild(1).getValue().toLowerCase();

    let call = { value: id, type: "call" };

    call.str = function () {
        return `call ${this.value} ;`;
    };

    return call;
}

function idlist(node) {
    let list = [];

    node.childs.forEach(function (curr) {
        list.push(curr.getValue().toLowerCase().trim());
    });

    return list;
}

function declaration(node) {
    let result = { ids: [], exp: null, type: "declaration" };

    node.ApplyAndGetData({
        "1": function (nodes) {
            result.ids = idlist(nodes[0]);
        },

        "2": function (nodes) {
            result.ids = idlist(nodes[0]);
            result.exp = expp(nodes[1]);
        },

        sendAsArray: true
    });

    result.str = function () {
        let ids = getIds(this.ids);

        if (this.exp) {
            return `var ${ids} = ${this.exp.str()} ;\n`;
        }
        else {
            return `var ${ids} ;\n`;
        }
    }

    return result;
}

function asignation(node) {
    let result = { ids: [], exp: null, type: "asignacion" };

    node.ApplyAndGetData({
        "2": function (nodes) {
            result.ids = idlist(nodes[0]);
            result.exp = expp(nodes[1]);
        },

        sendAsArray: true
    });

    result.str = function () {
        let ids = getIds(this.ids);

        if (this.exp) {
            return `${ids} = ${this.exp.str()} ;`;
        }
        return `# error en el codigo 3d`;
    }

    return result;
}

function stackpush(node) {
    let sp = {
        type: "stackpush",
        value: {
            access: value(node.getChild(0)),
            assign: value(node.getChild(1))
        }
    };

    sp.str = function () {
        return `Stack [ ${this.value.access.value} ] = ${this.value.assign.value} ;`
    };

    return sp;
}

function heappush(node) {
    let hp = {
        type: "heappush",
        value: {
            access: value(node.getChild(0)),
            assign: value(node.getChild(1))
        }
    };

    hp.str = function () {
        return `Heap [ ${this.value.access.value} ] = ${this.value.assign.value} ;`;
    }

    return hp;
}

function stackdeck() {
    let sd = {
        type: "stackdeck",
        str: function () {
            return `var Stack[] ;`
        }
    };

    return sd;
}

function heapdeck() {
    let hd = {
        type: "heapdeck",
        str: function () {
            return `var Heap[] ;`
        }
    }

    return hd;
}

exports.linealizeNode = function linealizeNode(node) {
    switch (node.getType().toLowerCase()) {
        case "etiqueta":
            return label(node);
        case "goto":
            return gotoo(node);
        case "if":
            return ifz(node);
        case "print":
            return printt(node);
        case "metodo":
            return method(node);
        case "call":
            return caall(node);
        case "end":
            return { type: "end", str: function () { return "end" } };
        case "declaracion":
            return declaration(node);
        case "asignacion":
            return asignation(node);
        case "stackpush":
            return stackpush(node);
        case "heappush":
            return heappush(node);
        case "stackdeck":
            return stackdeck();
        case "heapdeck":
            return heapdeck();
        case "comment":
            return { type: "comment", str: function () { return node.getChild(0).getValue() } }
    }

    return {};
};

