
const logger = require("../logger");

exports.validateExpression = function (o1, o2, operator) {

    let opType = "";

    switch (operator) {
        case "+":
        case "-":
        case "*":
        case "%":
        case "/":
        case "!":
        case "^^":
        case "===":

            opType = operator;
            break;

        case ">":
        case "<":
        case ">=":
        case "<=":

            opType = "O_R";
            break;

        case "==":
        case "!=":

            opType = "O_E";
            break;

        case "&&":
        case "||":
        case "^":

            opType = "O_L";
            break;

        case "++":
        case "--":

            opType = "O_I";
            break;
    }

    let operationsByType = OperationsAllowed[opType];

    if (operationsByType == null || operationsByType == undefined) {
        logger.logFatalError({
            "msg": "Operador no soportado",
            "opt": operator
        });

        return "INCORRECTO";
    }

    let operationSchema = null;

    let type1 = o1.type;
    let type2 = o2 == null ? null : o2.type;

    let validOp = operationsByType.some((schema) => {
        operationSchema = schema;

        return schema.o1 == type1 && schema.o2 == type2;
    });

    if (!validOp) {

        logger.logFatalError({
            "msg": "Operacion no soportada",
            "opt": operator
        });

        throw {
            msg: "La operacion no es valida",
            o1: o1,
            o2: o2,
            op: operator
        };
    }

    return operationSchema.res;
}

let OpTyp = {
    "INT": "integer",
    "DBL": "double",
    "CHR": "char",
    "STR": "string",
    "BOL": "boolean",
    "VOI": "void",
    "NON": -1
};

Object.freeze(OpTyp);

exports.OpTyp = OpTyp;

let OperationsAllowed = {

    "+": [
        { o1: OpTyp.INT, o2: OpTyp.DBL, res: OpTyp.DBL },
        { o1: OpTyp.DBL, o2: OpTyp.INT, res: OpTyp.DBL },
        { o1: OpTyp.DBL, o2: OpTyp.CHR, res: OpTyp.DBL },
        { o1: OpTyp.CHR, o2: OpTyp.DBL, res: OpTyp.DBL },
        { o1: OpTyp.DBL, o2: OpTyp.DBL, res: OpTyp.DBL },

        { o1: OpTyp.INT, o2: OpTyp.CHR, res: OpTyp.INT },
        { o1: OpTyp.CHR, o2: OpTyp.INT, res: OpTyp.INT },
        { o1: OpTyp.INT, o2: OpTyp.INT, res: OpTyp.INT },
        { o1: OpTyp.CHR, o2: OpTyp.CHR, res: OpTyp.STR },

        { o1: OpTyp.STR, o2: OpTyp.INT, res: OpTyp.STR },
        { o1: OpTyp.INT, o2: OpTyp.STR, res: OpTyp.STR },
        { o1: OpTyp.STR, o2: OpTyp.CHR, res: OpTyp.STR },
        { o1: OpTyp.CHR, o2: OpTyp.STR, res: OpTyp.STR },
        { o1: OpTyp.STR, o2: OpTyp.DBL, res: OpTyp.STR },
        { o1: OpTyp.DBL, o2: OpTyp.STR, res: OpTyp.STR },
        { o1: OpTyp.STR, o2: OpTyp.BOL, res: OpTyp.STR },
        { o1: OpTyp.BOL, o2: OpTyp.STR, res: OpTyp.STR },
        { o1: OpTyp.STR, o2: OpTyp.STR, res: OpTyp.STR },
    ],

    "-": [
        { o1: OpTyp.INT, o2: OpTyp.DBL, res: OpTyp.DBL },
        { o1: OpTyp.DBL, o2: OpTyp.INT, res: OpTyp.DBL },
        { o1: OpTyp.DBL, o2: OpTyp.CHR, res: OpTyp.DBL },
        { o1: OpTyp.CHR, o2: OpTyp.DBL, res: OpTyp.DBL },
        { o1: OpTyp.DBL, o2: OpTyp.DBL, res: OpTyp.DBL },

        { o1: OpTyp.INT, o2: OpTyp.CHR, res: OpTyp.INT },
        { o1: OpTyp.CHR, o2: OpTyp.INT, res: OpTyp.INT },
        { o1: OpTyp.INT, o2: OpTyp.INT, res: OpTyp.INT },
        { o1: OpTyp.CHR, o2: OpTyp.CHR, res: OpTyp.INT },

        { o1: OpTyp.INT, o2: null, res: OpTyp.INT },
        { o1: OpTyp.DBL, o2: null, res: OpTyp.DBL },
    ],

    "*": [
        { o1: OpTyp.INT, o2: OpTyp.DBL, res: OpTyp.DBL },
        { o1: OpTyp.DBL, o2: OpTyp.INT, res: OpTyp.DBL },
        { o1: OpTyp.DBL, o2: OpTyp.CHR, res: OpTyp.DBL },
        { o1: OpTyp.CHR, o2: OpTyp.DBL, res: OpTyp.DBL },
        { o1: OpTyp.DBL, o2: OpTyp.DBL, res: OpTyp.DBL },

        { o1: OpTyp.INT, o2: OpTyp.CHR, res: OpTyp.INT },
        { o1: OpTyp.CHR, o2: OpTyp.INT, res: OpTyp.INT },
        { o1: OpTyp.INT, o2: OpTyp.INT, res: OpTyp.INT },
        { o1: OpTyp.CHR, o2: OpTyp.CHR, res: OpTyp.INT },
    ],

    "%": [
        { o1: OpTyp.INT, o2: OpTyp.INT, res: OpTyp.INT }
    ],

    "/": [
        { o1: OpTyp.INT, o2: OpTyp.DBL, res: OpTyp.DBL },
        { o1: OpTyp.DBL, o2: OpTyp.INT, res: OpTyp.DBL },
        { o1: OpTyp.DBL, o2: OpTyp.CHR, res: OpTyp.DBL },
        { o1: OpTyp.CHR, o2: OpTyp.DBL, res: OpTyp.DBL },
        { o1: OpTyp.DBL, o2: OpTyp.DBL, res: OpTyp.DBL },

        { o1: OpTyp.INT, o2: OpTyp.CHR, res: OpTyp.INT },
        { o1: OpTyp.CHR, o2: OpTyp.INT, res: OpTyp.INT },
        { o1: OpTyp.INT, o2: OpTyp.INT, res: OpTyp.INT },
        { o1: OpTyp.CHR, o2: OpTyp.CHR, res: OpTyp.INT },
    ],

    "^^": [
        { o1: OpTyp.INT, o2: OpTyp.INT, res: OpTyp.INT },
    ],

    "O_R": [
        { o1: OpTyp.INT, o2: OpTyp.DBL, res: OpTyp.BOL },
        { o1: OpTyp.DBL, o2: OpTyp.INT, res: OpTyp.BOL },
        { o1: OpTyp.DBL, o2: OpTyp.CHR, res: OpTyp.BOL },
        { o1: OpTyp.CHR, o2: OpTyp.DBL, res: OpTyp.BOL },
        { o1: OpTyp.INT, o2: OpTyp.CHR, res: OpTyp.BOL },
        { o1: OpTyp.CHR, o2: OpTyp.INT, res: OpTyp.BOL },
        { o1: OpTyp.DBL, o2: OpTyp.DBL, res: OpTyp.BOL },
        { o1: OpTyp.INT, o2: OpTyp.INT, res: OpTyp.BOL },
        { o1: OpTyp.CHR, o2: OpTyp.CHR, res: OpTyp.BOL },
    ],

    "O_E": [
        { o1: OpTyp.INT, o2: OpTyp.DBL, res: OpTyp.BOL },
        { o1: OpTyp.DBL, o2: OpTyp.INT, res: OpTyp.BOL },
        { o1: OpTyp.DBL, o2: OpTyp.CHR, res: OpTyp.BOL },
        { o1: OpTyp.CHR, o2: OpTyp.DBL, res: OpTyp.BOL },
        { o1: OpTyp.INT, o2: OpTyp.CHR, res: OpTyp.BOL },
        { o1: OpTyp.CHR, o2: OpTyp.INT, res: OpTyp.BOL },
        { o1: OpTyp.DBL, o2: OpTyp.DBL, res: OpTyp.BOL },
        { o1: OpTyp.INT, o2: OpTyp.INT, res: OpTyp.BOL },
        { o1: OpTyp.CHR, o2: OpTyp.CHR, res: OpTyp.BOL },
        { o1: OpTyp.STR, o2: OpTyp.STR, res: OpTyp.BOL },
        { o1: OpTyp.BOL, o2: OpTyp.BOL, res: OpTyp.BOL },
    ],

    "===": [
        { o1: OpTyp.STR, o2: OpTyp.STR, res: OpTyp.BOL },
    ],

    "O_L": [
        { o1: OpTyp.BOL, o2: OpTyp.BOL, res: OpTyp.BOL },
    ],

    "!": [
        { o1: OpTyp.BOL, o2: null, res: OpTyp.BOL },
    ],

    "O_I": [
        { o1: OpTyp.INT, o2: null, res: OpTyp.INT },
        { o1: OpTyp.DBL, o2: null, res: OpTyp.DBL },
    ]
};
