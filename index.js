const express = require('express')
const bodyParser = require('body-parser');
const compiler = require("./Compiler");
const app = express();
const path = require("path");
const port = 3001

app.use(express.static(path.join(__dirname, 'frontend')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

compiler.startCompiler();

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + "/frontend/index.html"));
});

app.post('/jsharp/compiler', function (req, res) {
    let editors = req.body.editors;

    let code = "";
    let editorType = 0;
    let editorName = "";

    for (var i = 0; i < editors.length; i++) {
        var editor = editors[i];
        if (editor.first === "true") {
            code = editor.code;
            editorType = editor.type * 1;
            editorName = editor.name;
        }
    }

    if (editorType == 1) {
        compiler.compile(code, function (response) {
            res.send(response);
        });
    }
    else {
        res.send({
            msg: `El codigo del editor <${editorName}> no tiene una extension valida y no ha sido procesado`
        })
    }

});

app.post('/c3d/optimize', function (req, res) {
    let editor = req.body.editor;
    let code = editor.code;
    let optimizeType = req.body.optimizeType;

    compiler.optimize(
        {
            code: code,
            type: optimizeType
        },
        function (response) {
            res.send(response);
        }
    );
});

app.get('/jsharp/ast/graph', function (req, res) {

    //compiler.print_ast();

    compiler.create_graphviz(function (response) {

        var fs = require('fs')

        var file = path.join(__dirname + "/frontend/ast.html");

        fs.readFile(file, 'utf8', function (err, data) {
            if (err) {
                return console.log(err);
            }

            var result = data.replace("%%ast%%", response);

            res.send(result);
        });
    });
})

app.get('/c3d/graph', function (req, res) {

    compiler.create_c3d_graphviz(function (response) {

        var fs = require('fs')

        var file = path.join(__dirname + "/frontend/blocks.html");

        fs.readFile(file, 'utf8', function (err, data) {
            if (err) {
                return console.log(err);
            }

            var result = data.replace("%%ast%%", response);

            res.send(result);
        });
    });
})


app.listen(port, () => console.log(`Aplicacion iniciada en http://localhost:${port} .`))