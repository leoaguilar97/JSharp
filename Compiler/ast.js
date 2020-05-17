
/*
Usar en el archivo generado de la siguiente manera

var ast = require("./Compiler/ast");
var Node = ast.Node;
var Leaf = ast.Leaf;
var NodeType = ast.NodeType;
*/

var nodeNum = 0;
const logger = require('./logger');

exports.Node = function (value, type, line, col) {
    this.value = value;
    this.type = type.toLowerCase();
    this.line = line;
    this.col = col;

    this.dims = 0;

    this.childs = [];
    this.id = nodeNum++;
    this.associatedSymbols = [];
    this.scope = {};

    this.getRawValue = function () {
        return this.value;
    }

    this.getRawType = function () {
        return this.type;
    }

    this.getValue = function () {
        var val = this.value + "";

        return val.toLowerCase();
    }

    this.setValue = function (value) {
        this.value = value;
    }

    this.getType = function () {
        var val = this.type + "";

        return val.toLowerCase();
    }

    this.link = function (child) {
        this.childs.push(child);
    }

    this.linkChilds = function (newChilds) {
        newChilds.forEach(element => {
            this.childs.push(element);
        });
    }

    this.print = function (child, tabs) {
        if (child == null) {
            return;
        }

        var printable = "";

        for (var i = 0; i < tabs; i++) {
            printable += "-";
        }

        printable += " " + child.value;

        console.log(printable);

        if (child.childs != undefined && child.childs != null && child.childs.length > 0) {
            child.childs.forEach(element => {
                this.print(element, tabs + 1);
            });
        }
    }

    this.graph = function (child, parent) {
        if (child == null || child == undefined) {
            return "";
        }

        let result = "{";
        //add value and type
        let val = sanitize(child.value);
        let typ = typeAsString(child.type);

        if (val == typ) {
            result += "{" + val + "}";
        } else {
            result += "{" + val + "|" + typ + "}";
        }

        //add line and col
        if (child.line != "" || child.col != "") {
            result += "| { L" + child.line + "| C" + child.col + "}";
        }

        var records = "";

        if (child.childs != undefined && child.childs != null && child.childs.length > 0) {
            result += "| {"
            var i = 0;
            var cgpv = "";
            child.childs.forEach(element => {
                var lbl = "L" + child.id + i++;
                cgpv += "<" + lbl + ">" + (element ? typeAsString(element.type) : "epsilum") + "|";
                var parent = child.id + ":" + lbl;
                records += this.graph(element, parent);
            });
            result += cgpv.substr(0, cgpv.length - 1) + "}";
        }

        result += "}";

        var label = "\t" + child.id + "[label=\"" + result + "\"];\n";
        var connection = "";
        if (parent != "") {
            connection = "\t" + parent + " -> " + child.id + ";\n";
        }

        return label + records + connection;
    }

    this.graphviz = function () {
        var result = "digraph Tree {\n" + "\tnode[shape=record];\n";

        result += this.graph(this, "");

        return result + "}";
    }

    this.printRoot = function () {
        this.print(this, 0);
    }

    this.print_graphviz = function () {
        console.log(this.graphviz());
    }

    this.runAndApplyNode = function (node, apply, carry) {
        try {

            if (!node) {
                return;
            }

            let process = false;
            if (carry && carry.pre) {
                carry.pre(node, carry);
                process = carry.process || false;
            }

            apply(node, carry);

            if (carry.skipNext) {
                //continue to next sibling
                carry.skipNext = false;
                return;
            }

            if (node.childs != undefined && node.childs != null && node.childs.length > 0) {
                node.childs.forEach((element) => {
                    this.runAndApplyNode(element, apply, carry);
                });
            }

            if (carry && carry.post) {
                carry.process = process;
                carry.post(node, carry);
            }
        }
        catch (error) {
            console.trace(error);
            error.type = "SEMANTICO";

            error.line = 0;
            error.col = 0;
            if (error.node) {
                let linecol = error.node.getLineAndCol();
                error.line = linecol.line;
                error.col = linecol.col;
                error.node = "";
            }

            error.fullMessage = error.msg;

            logger.log(error);
            console.log(error);
        }
    }

    this.forEach = function (applyFunc) {

        if (this.childs == undefined || this.childs == null) {
            return;
        }

        //applyFunc(this);

        this.childs.forEach(applyFunc);
    }

    this.getCount = function () {
        if (this.childs == undefined || this.childs == null) {
            return 0;
        }

        return this.childs.length;
    }

    this.getChild = function (childNum) {
        if (this.getCount() <= childNum) {
            return null;
        }

        return this.childs[childNum];
    }

    this.getLineAndCol = function () {
        let result = { line: 0, col: 0 };

        for (let i = 0; i <= this.childs.length; i++) {
            let current = this.childs[i];
            if (current) {
                if (current.line != 0 || current.col != 0) {
                    result = { line: current.line, col: current.col };
                    break;
                }

                result = current.getLineAndCol();

                if (result.line != 0 || result.col != 0) {
                    break;
                }
            }
        }

        return result;
    }

    this.runAndApply = function (apply, carryModel) {

        this.runAndApplyNode(this, apply, carryModel);
    }

    this.ApplyAndGetData = function (criteria) {
        let cn = "" + this.getCount();

        let applyFunc = criteria[cn];

        if (!applyFunc) {
            return {};
        }

        if (criteria.sendAsArray) {
            return applyFunc(this.childs);
        }

        return applyFunc(this);
    }

    this.getChildCount = function () {
        return this.childs.length;
    }
}

function sanitize(str) {
    if (str == null || str == undefined) {
        return "";
    }

    str = str + "";

    return str
        .replace(new RegExp("\"", "g"), '\\\"')
        .replace(new RegExp("&", "g"), "&amp;")
        .replace(new RegExp("<", "g"), "&lt;")
        .replace(new RegExp(">", "g"), "&gt;");
}

function typeAsString(nt) {
    return nt;
}

exports.Leaf = function (id, value, line, col) {
    return new exports.Node(value, id == value ? "terminal" : id, line, col);
}

var NodeType = {
    "Root": 0,
    "Expression": 1,
    "Number": 2,
    "Symbol": 3
}

Object.freeze(NodeType);

exports.NodeType = NodeType;

exports.Clear = function () {
    nodeNum = 0;
}

