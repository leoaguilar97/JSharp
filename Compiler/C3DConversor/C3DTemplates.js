
class Template {
    constructor(info){

        this.info = info;

        this. createXor = function(o1T, o2T){
            let tRes = this.info.createTemporal();
            let lNext = this.info.createLabel();
        
            this.info.add( 
`
${tRes} = 1;
if (${o1T} == ${o2T}) goto ${lNext};
${tRes} = 0;
${lNext}:
`
);
        
            return tRes;
        };

        this. createRelational = function(o1T, o2T, operator){
            
            let tRes = this.info.createTemporal();
            let lTrue = this.info.createLabel();
            let lNext = this.info.createLabel();
            this.info.add( 
`
if (${o1T} ${operator} ${o2T}) goto ${lTrue};
${tRes} = 0;
goto ${lNext};
${lTrue}:
${tRes} = 1;
${lNext}:
`);
            return tRes;

        }
    }
}

exports.Template = Template;

