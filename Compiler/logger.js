LogType = {
    FATAL: "Fatal",
    SEMANTIC: "Semantico",
    SYNTAX: "Sintactico",
    LEXIC: "Lexico"
}

class LogManager {
    log(logInfo){
        this.logs.push(logInfo);
    }

    logFatalError(msg, line, col){
        this.log({
            msg: msg, 
            line: line,
            col: col,
            type: LogType.FATAL,
        })
    }

    printAll(){
        console.log("ERRORES");
        console.table(this.logs);
    }

    clear(){
        this.logs = [];
    }

    getLogs(){
        return this.logs;
    }

    hasErrors(){
        return this.logs.length != 0;
    }

    constructor(){
        this.logs = []
    }
}

let Logger = (function () {
    let instance;
 
    function createInstance() {
        let object = new LogManager();
        return object;
    }
 
    return {
        getInstance: function () {
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        }
    };
})();   

exports.logFatalError = function(msg, line, col){
    Logger.getInstance().logFatalError(msg, line, col);
};

exports.printAll = function(){
    Logger.getInstance().printAll();
};

exports.log = function(log){
    Logger.getInstance().log(log);
};

exports.clear = function(){
    Logger.getInstance().clear();
};

exports.getLogs = function(){
    return Logger.getInstance().getLogs();
};

exports.hasErrors = function(){
    return Logger.getInstance().hasErrors();
}