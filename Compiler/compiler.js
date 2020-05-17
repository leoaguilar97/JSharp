
const parser = require("./jsharp");
const ast = require("./ast");
const Viz = require('viz.js');
const { Module, render } = require('viz.js/full.render.js');
const c3d = require("./C3DConversor/C3D");
const st = require("./symtbl");
const logger = require("./logger");
const c3dparser = require("./c3d");
const Optimizer = require("./optimizer/optimizer").Optimizer;
let viz = new Viz({ Module, render });

var current_ast = null;
let optimizer;

let errorLog = {};

function convertTo3DCode(ast, callback) {
    // Obtener tabla de simbolos
    let symtbl = new st.SymTbl();


    ast.runAndApply(
        function (node, carry) {
            try {
                symtbl.addSymbol(node);
            }
            catch (error) {
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

                console.log(error);
                logger.log(error);
            }
        }
        ,
        {
            //preprocessing node to create scope if needed
            pre: function (node, carry) {
                carry.process = symtbl.check_create_environment(node);
            },
            //postprocessing to close scope
            post: function (node, carry) {
                if (carry.process) {
                    symtbl.finish_create_environment_and_result(node);
                }
            }
        }
    );

    symtbl.print();

    // Iniciar compilacion de simbolos
    let result = symtbl.startCompiling();
    if (logger.hasErrors()) {
        return callback({
            mensaje: "",
            symtbl: [],
            errors: logger.getLogs()
        })
    }
    else {
        return callback({
            mensaje: result,
            symtbl: symtbl.getJsonable(),
            errors: null
        });
    }
}

exports.optimize = function (codeInfo, callback) {
    let optimizeType = codeInfo.type;
    let code = codeInfo.code;
    logger.clear();
    current_ast = c3dparser.parse(code);
    optimizer = new Optimizer(current_ast, optimizeType);

    let optimizedCode = optimizer.optimize();

    if (logger.hasErrors()) {
        return callback({
            resultCode: "",
            errors: logger.getLogs()
        });
    }
    else {
        return callback({
            resultCode: optimizedCode,
            optimizations: optimizer.getOptimizations(),
            errors: null
        });
    }
}

exports.compile = function (code, callback) {
    try {
        logger.clear();

        current_ast = parser.parse(code);

        if (logger.hasErrors()) {
            return callback({
                mensaje: "",
                errors: logger.getLogs(),
                symtbl: []
            });
        }

        return convertTo3DCode(current_ast, callback);
    }
    catch (error) {
        console.log(error);

        if (error.indexOf("Parsing halted") >= 0) {
            logger.log({
                msg: "Error de sintaxis irrecuperable",
                line: "NA",
                col: "NA",
                type: "FATAL",
                token: "El codigo contiene codigo con sintaxis irrecuperable"
            });
        }

        return callback({
            mensaje: "Error en el servidor, intenta de nuevo",
            errors: [{
                msg: "Error en el servidor irrecuperable, intentar de nuevo.",
                fullMessage: error,
                line: 0,
                col: 0,
                type: "FATAL"
            }],
            symtbl: []
        });
    }
}

exports.startCompiler = function () {

    parser.parser.yy.createNode = function (id, childs) {
        let node = new ast.Node(id, id, 0, 0, childs);
        node.linkChilds(childs);
        return node;
    };

    parser.parser.yy.createLeaf = function (id, line, col, value) {
        return ast.Leaf(id, value, line, col);
    };

    parser.parser.yy.createRoot = function (childs) {
        let root = new ast.Node("raiz", "raiz", 0, 0);
        root.linkChilds(childs);
        return root;
    };

    parser.parser.yy.createError = function (token, line, col) {
        if (errorLog.validError) {
            errorLog.type = errorLog.msg.indexOf('INVALID') != -1 ? "LEXICO" : "SINTACTICO";

            logger.log(errorLog);
        }

        errorLog = {};
    }

    parser.Parser.prototype.parseError = function parseError(str, hash) {
        let expectingIndex = str.indexOf("Expecting");
        let msg = str.substring(expectingIndex, str.length);
        msg = msg.replace("Expecting", "Se esperaba").replace("got", "pero se obtuvo");
        errorLog.msg = msg;
        errorLog.validError = true;
        errorLog.fullMessage = str.replace("Expecting", "Se esperaba").replace("got", "pero se obtuvo").replace("on line", "en la línea").replace("Parse error", "Error en el código");
        errorLog.line = hash.loc.first_line;
        errorLog.col = hash.loc.first_column + 1;
        errorLog.token = hash.text;

        if (!hash.recoverable) {
            var error = new Error(str);
            error.hash = hash;
            throw error;
        }
    }

    // INICIALIZAR PARSER C3D
    c3dparser.parser.yy.createNode = function (id, childs) {
        let node = new ast.Node(id, id, 0, 0, childs);
        node.linkChilds(childs);
        return node;
    };

    c3dparser.parser.yy.createLeaf = function (id, line, col, value) {
        return ast.Leaf(id, value, line, col);
    };

    c3dparser.parser.yy.createRoot = function (childs) {
        let root = new ast.Node("raiz", "raiz", 0, 0);
        root.linkChilds(childs);
        return root;
    };

    c3dparser.parser.yy.createError = function (token, line, col) {
        if (errorLog.validError) {
            errorLog.line = line;
            errorLog.col = col;
            errorLog.type = errorLog.msg.indexOf('INVALID') != -1 ? "LEXICO" : "SINTACTICO";

            logger.log(errorLog);
        }

        errorLog = {};
    }

    c3dparser.Parser.prototype.parseError = function parseError(str, hash) {
        let expectingIndex = str.indexOf("Expecting");
        let msg = str.substring(expectingIndex, str.length);
        msg = msg.replace("Expecting", "Se esperaba").replace("got", "pero se obtuvo");
        errorLog.msg = msg;
        errorLog.validError = true;
        errorLog.fullMessage = str.replace("Expecting", "Se esperaba").replace("got", "pero se obtuvo").replace("on line", "en la línea").replace("Parse error", "Error en el código");

        errorLog.token = hash.text;


        if (!hash.recoverable) {
            var error = new Error(str);
            error.hash = hash;
            throw error;
        }
    }
}

/*************************
 * 
 * Funciones del AST
 * 
 * ***********************/

exports.create_graphviz = function (callback) {

    if (current_ast == null) {
        return callback("No se ha compilado el archivo");
    }

    var ast_str = current_ast.graphviz();

    viz.renderString(ast_str)
        .then(result => {
            callback(result);
        })
        .catch(error => {
            viz = new Viz({ Module, render });
            callback("Error, el archivo es muy grande.");
        });
}

exports.create_c3d_graphviz = function (callback) {
    let graph_str = optimizer ? optimizer.getGraph() : "digraph B { n0[label=\"Optimize el archivo primero\" shape=rect]}" ;
    viz.renderString(graph_str)
        .then(result => {
            callback(result);
        })
        .catch(error => {
            console.log(" ******** ERROR *********");
            console.error(error);
            viz = new Viz({ Module, render });
            callback("Error, el archivo es muy grande.");
        });
}

exports.create_graphviz_string = function (graphviz_string, callback) {
    viz.renderString(graphviz_string)
        .then(result => {
            callback(result);
        })
        .catch(error => {
            viz = new Viz({ Module, render });
            console.error(error);
        });
}

exports.print_ast = function () {
    if (current_ast == null) {
        return "No se ha compilado el archivo";
    }

    current_ast.printRoot();
}

exports.convertTo3DCode = convertTo3DCode;