
%lex
%options ranges
%options case-insensitive

D                 [0-9]
%s                comment
id  [a-zA-Z_][_a-zA-Z0-9]*

%%

"#".*                   return 'COMMENT';

"#*"                    this.begin('comment');

<comment>"*#"           this.popState(); return 'MULTICOMMENT';
<comment>.              /* skip comment content*/

\s+                     /* skip whitespace */

"var"       return 'VAR';
"stack"     return 'STACK';
"heap"      return 'HEAP';
"proc"      return 'PROC';
"begin"     return 'BEGIN';
"end"       return 'END';
"call"      return 'CALL';
"print"     return 'PRINT';
"goto"      return 'GOTO';
"if"        return 'IF';
"null"      return 'NULL';

","         return ',';
"+"         return '+';
"-"         return '-';
"*"         return '*';
"/"         return '/';
"%"         return '%';
'<>'        return '<>';
'=='        return '==';
'>='        return '>=';
'>'         return '>';
'<='        return '<=';
'<'         return '<';
"="         return '=';
'!'         return '!';

"("         return '(';
")"         return ')';
"["         return '[';

"]"         return ']';
";"         return ';';
":"         return ':';

[a-zA-Z_][a-zA-Z0-9_]*   return 'IDENTIFIER';
{D}+("."{D}+)?           return 'NUMBER';

"\""("%"("c"|"d"|"i"))"\"" { yytext = yytext.substr(1, yyleng-2); return 'FORMAT'; };

<<EOF>>     return 'EOF';
.           return 'INVALID';

/lex

%left '+' '-'
%left '*' '/' '%'
%left UMINUS

%start root

%% /* language grammar */

root
    : block EOF { return yy.createRoot([$1]); }
    ;

operator 
    : "+" 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    | minus { $$ = $1;}
    | "*" 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    | "/" 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    | "%" 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    | oprel { $$ = $1; }
    ;


oprel
    : "<>" 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    | "==" 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    | ">=" 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    | "<=" 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    | ">" 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    | "<" 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;

e
    : value operator value  { $$ = yy.createNode("e", [$1, $2, $3]); }
    | minus value             { $$ = yy.createNode("e", [$1, $2]); }
    | value                 { $$ = yy.createNode("e", [$1]); }
    | stack_pop             { $$ = $1; }
    | heap_pop              { $$ = $1; }
    ;

equal
    : "="   
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;

idlist 
    : identifier                { $$ = yy.createNode("id_list", [$1]); }
    | idlist "," identifier     { $1.link($3); $$ = $1; }
    ;

assignment
    : idlist equal e ";"        { $$ = yy.createNode("asignacion", [$1, $3]); }
    | var idlist equal e ";"    { $$ = yy.createNode("declaracion", [$2, $4]); }
    | var idlist ";"            { $$ = yy.createNode("declaracion", [$2]); }   
    ;

stack_pop 
    : stack "[" value "]" { $$ = yy.createNode("stackpop", [$3]); }
    ;

heap_pop
    : heap "[" value "]" { $$ = yy.createNode("heappop", [$3]); }
    ;

stack_assignment
    : stack "[" value "]" "=" value ";" { $$ = yy.createNode("stackpush", [$3, $6]); }
    ;

heap_assignment
    : heap "[" value "]" "=" value ";" { $$ = yy.createNode("heappush", [$3, $6]); }
    ;

label_dec 
    : identifier ":" { $$ = yy.createNode("etiqueta", [$1]); }
    ;

goto_dec
    : goto identifier ";" { $$ = yy.createNode("goto", [$1, $2]); }
    ;

if_then
    : if "(" e ")" goto_dec { $$ = yy.createNode("if", [$1, $3, $5.getChild(1)]); }
    ;

method_dec
    : proc identifier begin block end { $$ = yy.createNode("metodo", [$1, $2, $3, $4, yy.createNode("end", $5)]); }
    ;

call_dec
    : call identifier ";" { $$ = yy.createNode("call", [$1, $2]); }
    ;

print_dec
    : print "(" format "," e ")" ";" { $$ = yy.createNode("print", [$1, $3, $5]); }
    ;

struct_dec
    : var stack '[' ']' ';' { $$ = yy.createNode("stackdeck", [$2]); }
    | var heap '[' ']'  ';' { $$ = yy.createNode("heapdeck", [$2]); }
    ;

statement 
    : assignment        { $$ = $1; } /* asignacion de variables y temporales */
    | stack_assignment  { $$ = $1; } /* asignacion de stack */
    | heap_assignment   { $$ = $1; } /* asignacion de heap */
    | label_dec         { $$ = $1; } /* etiqueta */
    | goto_dec          { $$ = $1; } /* goto */
    | if_then           { $$ = $1; } /* if */
    | method_dec        { $$ = $1; } /* metodo */
    | call_dec          { $$ = $1; } /* call */
    | print_dec         { $$ = $1; } /* print */
    | struct_dec        { $$ = $1; }
    | comment           { $$ = yy.createNode("comment", [$1]); }
    | error ';'         { yy.createError($1, @1.first_line, @1.first_column);  $$ = yy.createLeaf("ERROR", @1.first_line, @1.first_column, $1); }
    ;

statements 
    : statements statement  { $1.push($2); $$ = $1; }
    | statement             { $$ = [$1]; }
    ;

block 
    : statements    { $$ = yy.createNode("sentencias", $1); }
    | /* epsilum */ { $$ = yy.createNode("sentencias", []); }
    | error end     { yy.createError($1, @1.first_line, @1.first_column);  $$ = yy.createLeaf("ERROR", @1.first_line, @1.first_column, $1); }
    ;

value 
    : identifier    { $$ = $1; }
    | number        { $$ = $1; }
    ;

/******************************************
*
* KEYWORDS
*
*******************************************/

format
    : FORMAT
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;

print
    : PRINT 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;


identifier
    : IDENTIFIER 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf("id", line, col, $1);
    }
    ;

number
    : NUMBER 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf("number", line, col, $1);
    }
    ;

var
    : VAR
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;

stack 
    : STACK 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;

heap
    : HEAP 
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;

proc
    : PROC  
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;

begin
    : BEGIN  
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;

end
    : END  
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;

call
    : CALL  
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;


goto
    : GOTO
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;

if
    : IF  
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;

minus
    : "-"   
    {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;

comment 
    : COMMENT{
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    | MULTICOMMENT {
        var line = this._$.first_line;
        var col = this._$.first_column;
        $$ = yy.createLeaf($1, line, col, $1);
    }
    ;
    