// lexical grammar

%lex
%options case-insensitive
%options ranges
%option caseless


D                 [0-9]
NZ                [1-9]
Ds                ("0"|{NZ}{D}*)
EXPO              ([Ee][+-]?{Ds})
BSL               "\\".
%s                comment

%%

"//".*                /* skip comments          */
"/*"                  this.begin('comment');
<comment>"*/"         this.popState();
<comment>.            /* skip comment content   */
\s+                   /* skip whitespace        */

"{"                   return 'EMBRACE';
"}"                   return 'UNBRACE';

"("                   return 'LEFT_PAREN';
")"                   return 'RIGHT_PAREN';

"["                   return 'LEFT_BRACKET';
"]"                   return 'RIGHT_BRACKET';

"."                   return 'POINT';
","                   return 'COMMA';
":"                   return 'COLON';
";"                   return 'SEMICOLON';

"import"              return 'KEYWORD_IMPORT';
"var"                 return 'KEYWORD_VAR';
"const"               return 'KEYWORD_CONST';
"global"              return 'KEYWORD_GLOBAL';

"void"                return 'KEYWORD_VOID';

"if"                  return 'KEYWORD_IF';
"else"                return 'KEYWORD_ELSE';

"for"                 return 'KEYWORD_FOR';
"while"               return 'KEYWORD_WHILE';
"do"                  return 'KEYWORD_DO';

"break"               return 'KEYWORD_BREAK';
"continue"            return 'KEYWORD_CONTINUE';

"switch"              return 'KEYWORD_SWITCH';
"case"                return 'KEYWORD_CASE';
"default"             return 'KEYWORD_DEFAULT';

"define"              return 'KEYWORD_DEFINE';
"as"                  return 'KEYWORD_AS';

"print"               return 'KEYWORD_PRINT';     

"try"                 return 'KEYWORD_TRY';       
"catch"               return 'KEYWORD_CATCH';     
"throw"               return 'KEYWORD_THROW';

"strc"                return 'KEYWORD_STRC';

"new"                 return 'KEYWORD_NEW';
"return"              return 'KEYWORD_RETURN';

"boolean"             return 'KEYWORD_BOOLEAN';
"integer"             return 'KEYWORD_INTEGER';
"double"              return 'KEYWORD_DOUBLE';
"char"                return 'KEYWORD_CHAR';

"<="                  return 'OPERATOR_LESS_THAN_EQUAL';
"<"                   return 'OPERATOR_LESS_THAN';
"==="                 return 'OPERATOR_REFERENCE_EQUAL';
"=="                  return 'OPERATOR_EQUAL';
">="                  return 'OPERATOR_GREATER_THAN_EQUAL';
">"                   return 'OPERATOR_GREATER_THAN';
"!="                  return 'OPERATOR_NOT_EQUAL';
"||"                  return 'OPERATOR_LOGICAL_OR';
"^^"                  return 'OPERATOR_POT';
"^"                   return 'OPERATOR_XOR';
"&&"                  return 'OPERATOR_LOGICAL_AND';
"!"                   return 'OPERATOR_NEGATION';
"="                   return 'OPERATOR_ASSIGNMENT';
"++"                  return 'OPERATOR_INCREMENT';
"+"                   return 'OPERATOR_ADDITION';
"--"                  return 'OPERATOR_DECREMENT';
"-"                   return 'OPERATOR_SUBTRACTION';
"*"                   return 'OPERATOR_MULTIPLICATION';
"/"                   return 'OPERATOR_DIVISON';
"%"                   return 'OPERATOR_MODULO';

"null"                return 'NULL_LITERAL';
"true"                return 'TRUE_LITERAL';
"false"               return 'FALSE_LITERAL';

[a-zA-ZñÑ_][a-zA-ZñÑ0-9_]*   return 'IDENTIFIER'; 

[0-9]+"."[0-9]+\b     return 'FLOATING_POINT_LITERAL';
[0-9]+\b              return 'DECIMAL_INTEGER_LITERAL';

"\"\""                return 'STRING_LITERAL';
"\""([^"]|{BSL})*"\"" return 'STRING_LITERAL';
"'"([^']|{BSL})?"'"   return 'CHAR_LITERAL';

<<EOF>>               return 'EOF';
.                     return 'INVALID';

/lex

%right  OPERATOR_ASSIGNMENT
%left   OPERATOR_LOGICAL_OR
%left   OPERATOR_LOGICAL_AND
%left   OPERATOR_XOR
%left   OPERATOR_EQUAL OPERATOR_NOT_EQUAL
%left   OPERATOR_LESS_THAN OPERATOR_GREATER_THAN OPERATOR_LESS_THAN_EQUAL OPERATOR_GREATER_THAN_EQUAL
%left   OPERATOR_ADDITION OPERATOR_SUBTRACTION
%left   OPERATOR_MULTIPLICATION OPERATOR_DIVISION OPERATOR_MODULO
%right  OPERATOR_NEGATION
%right  POST_INCREMENT POST_DECREMENT

%start compilation_unit

%%

///////////////////////////////////////////////////////////////////////////////////////////////////////////
// INICIO DE GRAMATICA 
///////////////////////////////////////////////////////////////////////////////////////////////////////////

compilation_unit
  : EOF { return yy.createRoot([]); }
  | member_list EOF { return yy.createRoot([$1]); }
  ;


// Lista de miembros ejecutables de un programa

member_list 
  : member      { $$ = yy.createNode("miembros", [$1]); }
  | member_list member { $1.link($2); $$ = $1; }
  ;

member 
  : import_list member_separator  { $$ = $1; }
  | function                      { $$ = $1; }
  | declaration member_separator  { $$ = $1; }
  | error member_separator        { yy.createError($1, @1.first_line, @1.first_column);  $$ = yy.createLeaf("ERROR", @1.first_line, @1.first_column, $1); }
  ;

// lista de imports

import_separator
  : OPERATOR_SUBTRACTION { $$ = '-' }
  | POINT { $$ = '.'; }
  ;

import_content
  : identifier { $$ = $1; }
  | literal    { $$ = $1; }
  ;

import_name 
  : identifier { $$ = $1; }
  | import_name import_separator import_content { 
    $1.setValue($1.getValue() + $2 + $3.getValue());
    $$ = $1;
  }
  ;

import_list 
  : keyword_import import_name { 
      $$ = yy.createNode("importar", 
        [
          $1, 
          yy.createNode("archivos", [ yy.createLeaf("archivo", @2.first_line, @2.first_column, $2.getValue()) ])
        ]);
    }

  | import_list COMMA import_name { 
      $1.getChild(1).link(yy.createLeaf("archivo", @3.first_line, @3.first_column,  $3.getValue())); 
      $$ = $1; 
    }
  ;

////////////////////////////////////////////////
// declaracion de funciones
////////////////////////////////////////////////

function 
  : type identifier params environment { $4.isFromFunct = true; $$ = yy.createNode("funcion", [$1, $2, $3, $4]); }
  | identifier identifier params environment { $4.isFromFunct = true; $$ = yy.createNode("funcion", [$1, $2, $3, $4]); }
  | keyword_void identifier params environment { $4.isFromFunct = true; $$ = yy.createNode("funcion", [$1, $2, $3, $4]); }
  | error UNBRACE { yy.createError($1, @1.first_line, @1.first_column); $$ = yy.createLeaf("ERROR", @1.first_line, @1.first_column, $1); }
  ;

params 
  : LEFT_PAREN param_list RIGHT_PAREN { $$ = yy.createNode("parametros", $2); }
  | LEFT_PAREN RIGHT_PAREN { $$ = yy.createNode("parametros", []); }
  | error RIGHT_PAREN { yy.createError($1, @1.first_line, @1.first_column); $$ = yy.createLeaf("ERROR", @1.first_line, @1.first_column, $1); }
  ;

param_list 
  : type identifier { $$ = [yy.createNode("parametro", [$1, $2])]; }
  | identifier identifier { $$ = [yy.createNode("parametro", [$1, $2])]; }
  | param_list COMMA type identifier { $1.push(yy.createNode("parametro", [$3, $4])); $$ = $1; }
  | param_list COMMA identifier identifier { $1.push(yy.createNode("parametro", [$3, $4])); $$ = $1; }
  ;

//////////////////////////////////////////////////////////
// AMBIENTES 
/////////////////////////////////////////////////////////

environment_member
  : asignation SEMICOLON { $$ = $1; }
  | asignation  { $$ = $1; }

  | declaration SEMICOLON { $$ = $1; }
  | declaration  { $$ = $1; }
  
  | if { $$ = $1; }
  | switch { $$ = $1; }
   
  | for { $$ = $1; }
  | while { $$ = $1; }
  
  | do_while SEMICOLON { $$ = $1; }
  | do_while  { $$ = $1; }
  
  | break SEMICOLON { $$ = $1; }
  | break  { $$ = $1; }

  | continue SEMICOLON { $$ = $1; }
  | continue  { $$ = $1; }

  | return SEMICOLON { $$ = $1; }

  | try_catch
  | throw

  | print SEMICOLON { $$ = $1; }
  | print  { $$ = $1; }


  | struct SEMICOLON
  //| postfix_expression SEMICOLON { $$ = $1; }

  | identifier OPERATOR_INCREMENT { 
    var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2); 
    $$ = yy.createNode("E", [yy.createNode("acceso", [$1]), opNode]); 
  }
  | identifier OPERATOR_DECREMENT {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2); 
      $$ = yy.createNode("E", [yy.createNode("acceso", [$1]), opNode]); 
    }
  | call { $$ = $1; }

  | identifier OPERATOR_INCREMENT SEMICOLON { 
    var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2); 
    $$ = yy.createNode("E", [yy.createNode("acceso", [$1]), opNode]); 
  }
  | identifier OPERATOR_DECREMENT SEMICOLON {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2); 
      $$ = yy.createNode("E", [yy.createNode("acceso", [$1]), opNode]); 
    }
  | call SEMICOLON { $$ = $1; }
  
  | error SEMICOLON { yy.createError($1, @1.first_line, @1.first_column); $$ = yy.createLeaf("ERROR", @1.first_line, @1.first_column, $1); }
  ;

environment_body
  : environment_member { $$ = [$1]; }
  | environment_body environment_member { $1.push($2); $$ = $1;}
  ;

environment 
  : EMBRACE UNBRACE { $$ = yy.createNode("ambiente", []); } 
  | EMBRACE environment_body UNBRACE { $$ = yy.createNode("ambiente", $2); }
  | EMBRACE error UNBRACE { yy.createError($2, @2.first_line, @2.first_column); $$ = yy.createLeaf("ERROR", @2.first_line, @2.first_column, $2); }
  ;

//////////////////////////////////////////
// Variables
/////////////////////////////////////////
id_list 
  : identifier { $$ = yy.createNode("identificadores", [$1]); }
  | id_list COMMA identifier { $1.link($3); $$ = $1; }
  ;

declarated_value 
  : OPERATOR_ASSIGNMENT expression { $$ = $2; }
  | /* epsilum */ { $$ = yy.createNode("vacio", []); }
  ;

declaration 
  : type id_list declarated_value { $$ = yy.createNode("declaracion", [$1, $2, $3]); }
  | identifier id_list declarated_value { $$ = yy.createNode("declaracion", [$1, $2, $3]); }
  | keyword_var id_list  COLON declarated_value { $$ = yy.createNode("declaracion", [$1, $2, $4]); }
  | keyword_const id_list COLON declarated_value { $$ = yy.createNode("declaracion", [$1, $2, $4]); }
  | keyword_global id_list COLON declarated_value { $$ = yy.createNode("declaracion", [$1, $2, $4]); }
  ;

asignation 
  : identifier OPERATOR_ASSIGNMENT expression { $$ = yy.createNode("asignacion", [$1, $3]); }
  ;

/////////////////////////////////////////////////////
// SENTENCIA DE CONTROL
////////////////////////////////////////////////////

/////// SENTENCIAS DE CONTROL //////////////////////

////// IF

simple_if 
  : keyword_if LEFT_PAREN expression RIGHT_PAREN environment { $$ = yy.createNode("if", [$1, $3, $5]); }
  ;

else
  : keyword_else environment { $$ = yy.createNode("else", [$1, $2]); }
  ;

else_if
  : keyword_else simple_if { $$ = yy.createNode("else_if", [$1, $2]); }
  ;

else_if_list
  : else_if { $$ = [$1]; }
  | else_if_list else_if { $1.push($2); $$ = $1; }
  ;

if 
  : simple_if { $$ = $1; }
  | simple_if else { $$ = yy.createNode("if_else", [$1, $2]); }
  | simple_if else_if_list { $$ = yy.createNode("if_else_if", [$1, yy.createNode("else_if", $2)]); }
  | simple_if else_if_list else { $$ = yy.createNode("if_else_if_else", [$1, yy.createNode("else_if", $2), $3]); }
  ;

//////////// SWITCH
case
  : keyword_case expression COLON environment_body { $4 = yy.createNode("ambiente", $4); $$ = yy.createNode("case", [$1, $2, $4]); }
  ;

case_list
  : case { $$ = yy.createNode("case_list", [$1]); }
  | case_list case { $1.link($2); $$ = $1; }
  ;

default
  : keyword_default COLON environment_body { $3 = yy.createNode("ambiente", $3); $$ = yy.createNode("default", [$1, $3]); }
  ;

switch_body
  : EMBRACE case_list UNBRACE { $$ = yy.createNode("switch_body", [$2]); }
  | EMBRACE case_list default UNBRACE { $$ = yy.createNode("switch_body", [$2, $3])}
  | EMBRACE default UNBRACE { let cases = yy.createNode("case_list", []); $$ = yy.createNode("switch_body", [cases, $2]); }
  | EMBRACE UNBRACE { $$ = yy.createNode("switch_body", []); }
  ; 

switch
  : keyword_switch LEFT_PAREN expression RIGHT_PAREN switch_body { $$ = yy.createNode("switch", [$1, $3, $5]); }
  ;
  
/////// SENTENCIAS CICLICAS //////////////////////
while_exp
  : keyword_while LEFT_PAREN expression RIGHT_PAREN { $$ = yy.createNode("while_exp", [$1, $3]); }
  ;

////// WHILE
while 
  : while_exp environment { $$ = yy.createNode("while", [$1, $2]); }
  ;

////// DO-WHILE
do_while
  : keyword_do environment while_exp { $$ = yy.createNode("do_while", [$1, $2, $3]); }
  ;

////// FOR
for_init
  : asignation { $$ = $1; }
  | declaration { $$ = $1; }
  | { $$ = null; }
  ;

for_cond
  : expression { $$ = $1; }
  | { $$ = null; }
  ;

for_final
  : expression { $$ = $1; }
  | asignation { $$ = $1; }
  | { $$ = null; }
  ;

for
  : keyword_for LEFT_PAREN for_init SEMICOLON for_cond SEMICOLON for_final RIGHT_PAREN environment
  {
    $$ = yy.createNode("for", [$1, $3, $5, $7, $9]);
  }

  ;

///// SENTENCIAS DE TRANSFERENCIA
break 
  : keyword_break { $$ = yy.createNode("break", [$1]); }
  ;

continue
  : keyword_continue { $$ = yy.createNode("continue", [$1]); }
  ;

////////// SENTENCIA RETURN /////////////////////////

return  
  : keyword_return expression { $2.isReturn = true; $$ = yy.createNode("retornar", [$1, $2]); }

  | keyword_return { $$ = yy.createNode("retornar", [$1, null]); }
  ;

////////////////////////////////////////////////////
// EXCEPCIONES
////////////////////////////////////////////////////
try 
  : keyword_try environment 
  
;

catch
  : keyword_catch LEFT_PAREN identifier identifier RIGHT_PAREN environment
  ;

try_catch
  : try catch 
  ;

throw
  : keyword_throw keyword_strc identifier LEFT_PAREN RIGHT_PAREN
  ;

/////////////////////////////////////////////////////
// IMPRIMIR
/////////////////////////////////////////////////////
print
  : keyword_print LEFT_PAREN expression RIGHT_PAREN { $$ = yy.createNode("print", [$1, $3]); }
  ;

/////////////////////////////////////////////////////
// EXPRESIONES
/////////////////////////////////////////////////////

// expresiones aritmeticas, logicas, relacionales, de acceso, etc.
expression
  : conditional_or_expression { $$ = yy.createNode("E", [$1]); }
  | data_list
  | array_instance
  //| error { yy.createError($1, @1.first_line, @1.first_column); $$ = yy.createLeaf("ERROR", @1.first_line, @1.first_column, $1); }
  ;

// a || b
conditional_or_expression
  : conditional_and_expression
    {
      $$ = $1;
    }
  | conditional_or_expression OPERATOR_LOGICAL_OR conditional_and_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);      
    }
  ;

// a && b
conditional_and_expression
  : exclusive_or_expression
    { 
      $$ = $1; 
    }
  | conditional_and_expression OPERATOR_LOGICAL_AND exclusive_or_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);      
    }
  ;


// a ^ b
exclusive_or_expression
  : equality_expression
    { 
      $$ = $1; 
    }
  | exclusive_or_expression OPERATOR_XOR equality_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);      
    }
  ;

// a == b
// a != b
equality_expression
  : relational_expression
    { 
      $$ = $1; 
    }
  | equality_expression OPERATOR_EQUAL relational_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);      
    }
  | equality_expression OPERATOR_NOT_EQUAL relational_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);      
    }
  | equality_expression OPERATOR_REFERENCE_EQUAL relational_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);
    }
  ;

// a < b
// a <= b 
// a > b
// a >= b
relational_expression
  : additive_expression
    { 
      $$ = $1; 
    }
  | relational_expression OPERATOR_LESS_THAN additive_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);      
    }
  | relational_expression OPERATOR_LESS_THAN_EQUAL additive_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);      
    }
  | relational_expression OPERATOR_GREATER_THAN additive_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);      
    }
  | relational_expression OPERATOR_GREATER_THAN_EQUAL additive_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);      
    }
  ;

// a + b
// a - b
additive_expression
  : multiplicative_expression
    { 
      $$ = $1; 
    }
  | additive_expression OPERATOR_ADDITION multiplicative_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);
    }
  | additive_expression OPERATOR_SUBTRACTION multiplicative_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);
    }
  ;

// a * b
// a / b
// a % b
multiplicative_expression
  : power_expression
    {
      $$ = $1;
    }
  | multiplicative_expression OPERATOR_MULTIPLICATION power_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);
    }
  | multiplicative_expression OPERATOR_DIVISON power_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);
    }
  | multiplicative_expression OPERATOR_MODULO power_expression
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);
    }
  ;

// a ^^ b
power_expression 
  : unary_expression
    {
      $$ = $1;
    }
  | power_expression OPERATOR_POT unary_expression 
    {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2);
      $$ = yy.createNode("E", [$1, opNode, $3]);
    }
  ;

// -a
// !a
// (a) b
unary_expression
  : postfix_expression
    { 
      $$ = $1; 
    }
  | OPERATOR_SUBTRACTION unary_expression
    {
      var opNode = yy.createLeaf($1, @1.first_line, @1.first_column, $1);
      $$ = yy.createNode("E", [opNode, $2]);
    }
  | OPERATOR_NEGATION unary_expression
    {
      var opNode = yy.createLeaf($1, @1.first_line, @1.first_column, $1);
      $$ = yy.createNode("E", [opNode,  $2]);
    }
  | LEFT_PAREN type RIGHT_PAREN unary_expression
    {
      $$ = yy.createNode("cast", [$2, $4]);
    }
  ;
  
//a++
//a--
//++a
//--a
postfix_expression
  : primary { $$ = $1; }
  | identifier { $$ = yy.createNode("acceso", [$1]); }
  | identifier OPERATOR_INCREMENT { 
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2); 
      $$ = yy.createNode("E", [yy.createNode("acceso", [$1]), opNode]); 
    }
  | identifier OPERATOR_DECREMENT {
      var opNode = yy.createLeaf($2, @2.first_line, @2.first_column, $2); 
      $$ = yy.createNode("E", [yy.createNode("acceso", [$1]), opNode]); 
    }
  | call { $$ = $1; }
  ;

// identificadores
// true, false,
// 0,1,2,3,...
// "strings"
primary
  : literal { $$ = yy.createNode("Literal", [$1]); }
  | LEFT_PAREN exclusive_or_expression RIGHT_PAREN { $$ = $2; }
  ;

// lista de corchetes {exp, exp, exp}
data_list
  : EMBRACE exp_list UNBRACE
  ;

// lista de expresiones: exp [,exp]*
exp_list 
  : expression { $$ = [$1]; }
  | exp_list COMMA expression { $1.push($3); $$ = $1; }
  ;

// declaracion de arreglos
array_instance
  : keyword_strc type LEFT_BRACKET expression RIGHT_BRACKET
  ;

/////////////////////////////////////////////////////
// LLAMADAS A FUNCIONES
/////////////////////////////////////////////////////

// funct1(exp1, exp2, ..., expn)
// funct2(val1= exp1, val2= exp2, ..., valn = expn)
// funct3()
call
  : identifier LEFT_PAREN exp_list RIGHT_PAREN { let pars = yy.createNode("params", $3); $$ = yy.createNode("call", [$1, pars]); }
  | identifier LEFT_PAREN call_params_list_with_id RIGHT_PAREN
  | identifier LEFT_PAREN RIGHT_PAREN { $$ = yy.createNode("call", [$1]); }
  ;

// lista de llamadas de parametro con identificador
call_params_list_with_id
  : call_params_list_with_id COMMA call_param_with_id
  | call_param_with_id
  ;

// llamada de parametro con identificador
call_param_with_id
  : identifier OPERATOR_ASSIGNMENT expression
  ;

/////////////////////////////////////////////////////////////
// DEFINICION DE ESTRUCTURAS
/////////////////////////////////////////////////////////////

struct_head
  : keyword_define identifier keyword_as
  ;

struct_attributes
  : struct_attribute
  | struct_attributes COMMA struct_attribute
  ;

struct_attribute
  : type identifier
  | type identifier operator_assignment expression
  | identifier identifier
  | identifier identifier operator_assignment expression
  ;

struct
  : struct_head LEFT_BRACKET struct_attributes RIGHT_BRACKET
  ;

/////////////////////////////////////////////////////////////
// KEYWORDS 
/////////////////////////////////////////////////////////////

keyword_strc
  :
  KEYWORD_STRC    
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_var 
  :
  KEYWORD_VAR    
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_const 
  :
  KEYWORD_CONST    
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_global
  :
  KEYWORD_GLOBAL 
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_try 
  :
  KEYWORD_TRY    
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_catch 
  :
  KEYWORD_CATCH    
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_throw 
  :
  KEYWORD_THROW    
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_define 
  :
  KEYWORD_DEFINE    
  {
    var line = this._$.first_line;
    var col = this._$.first_column;

    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_as 
  :
  KEYWORD_AS    
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_void
  :
  KEYWORD_VOID
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_import 
  :     
  KEYWORD_IMPORT
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_if 
  :
  KEYWORD_IF
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_else
  :
  KEYWORD_ELSE
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_while
  :
  KEYWORD_WHILE
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_do
  :
  KEYWORD_DO
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_for
  :
  KEYWORD_FOR
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_break
  :
  KEYWORD_BREAK
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_continue
  :
  KEYWORD_CONTINUE
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_switch
  :
  KEYWORD_SWITCH
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_case
  :
  KEYWORD_CASE
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_default
  :
  KEYWORD_DEFAULT
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_return
  :
  KEYWORD_RETURN    
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_boolean
  :
  KEYWORD_BOOLEAN    
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_integer
  :
  KEYWORD_INTEGER    
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_double
  :  
  KEYWORD_DOUBLE 
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_string
  :
  KEYWORD_STRING    
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_char
  :
  KEYWORD_CHAR    
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

keyword_print 
  : 
  KEYWORD_PRINT
  {
    var line = this._$.first_line;
    var col = this._$.first_column;
    $$ = yy.createLeaf($1, line, col, $1);
  }
  ;

operator_assignment 
  :
  OPERATOR_ASSIGNMENT
    {
      var line = this._$.first_line;
      var col = this._$.first_column;
      $$ = yy.createLeaf($1, line, col, $1);
    }
    ;

colon
  : 
  COLON
    {
      var line = this._$.first_line;
      var col = this._$.first_column;
      $$ = yy.createLeaf($1, line, col, $1);
    }
    ;
    

identifier 
  :
  IDENTIFIER
    {
      var line = this._$.first_line;
      var col = this._$.first_column;
      $$ = yy.createLeaf($1.toLowerCase(), line, col, $1.toLowerCase());
    }
    ;

 
literal
  : integer_literal
    {
      $$ = $1;
    }
  | floating_point_literal
    {
      $$ = $1;
    }
  | boolean_literal
    {
      $$ = $1;
    }
  | string_literal
    {
      $$ = $1;
    }
  | char_literal 
    {
      $$ = $1;
    }
  | null_literal
    {
      $$ = $1;
    }
  ;

integer_literal
  : DECIMAL_INTEGER_LITERAL
    {
      var line = this._$.first_line;
      var col = this._$.first_column;
      $$ = yy.createLeaf("integer", line, col, parseInt($1));
    }
  ;

floating_point_literal
  : FLOATING_POINT_LITERAL
    {
      var line = this._$.first_line;
      var col = this._$.first_column;

      $$ = yy.createLeaf("double", line, col, parseFloat($1));
    }
  ;

boolean_literal
  : TRUE_LITERAL
    {
      var line = this._$.first_line;
      var col = this._$.first_column;

      $$ = yy.createLeaf("boolean", line, col, true);
    }
  | FALSE_LITERAL
    {
      var line = this._$.first_line;
      var col = this._$.first_column;

      $$ = yy.createLeaf("boolean", line, col, false);
    }
  ;

string_literal
  : STRING_LITERAL
    {
      var line = this._$.first_line;
      var col = this._$.first_column;

      var value = $1.replace("\"", "").replace("\"", "");
      $$ = yy.createLeaf("string", line, col, value);
    }
  ;

char_literal 
  : CHAR_LITERAL 
  {
    var value = $1.replace("'");
    var line = this._$.first_line;
    var col = this._$.first_column;

    $$ = yy.createLeaf("char", line, col, $1);
  }
  ;

null_literal
  : NULL_LITERAL
    {
      var line = this._$.first_line;
      var col = this._$.first_column;
      $$ = yy.createLeaf("string", line, col, null);
    }
  ;

type
  : keyword_boolean { $$ = $1; }
  | keyword_integer { $$ = $1; }
  | keyword_double { $$ = $1; }
  | keyword_char { $$ = $1; }
  | keyword_string { $$ = $1; }
  ;