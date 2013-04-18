/*
 * This chart will display a pie chart of story points broken down by category.
 * 
 * The category is chosen by putting the Rally field name into categoryField
 * (remember there are no spaces in Rally field names)
 * 
 */
 Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    categoryField: 'WorkType',
    items: [{xtype:'container',itemId:'chart_box'},{xtype:'container',itemId:'selector_box'}],
    launch: function() {
        this._getStories();
    },
    
    _log: function( msg ) {
        var me = this;
        window.console && console.log( new Date(), msg );
    },
    _getStories: function() {
        this._log("_getStories");
        Ext.create('Rally.data.WsapiDataStore',{
            model:'UserStory',
            autoLoad: true,
            listeners: {
                load: function(store,data){
                    this._log(["store",data]);
                    if ( data.length === 0 ) {
                        this._log("No data found");
                    } else {
                        if ( ! this._isValidField( this.categoryField, data[0] ) ){
                            alert(this.categoryField + " is not a valid field name for this model");
                        } else {
                            this._countPointsByCategory(data);
                        }
                    }
                   
                },
                scope: this
            }
        });
    },
    _countPointsByCategory: function(records) {
        this._log("_countPointsByCategory");
        var me = this;
        var counts = {};
        var counter = 0;
        var total = 0;
        Ext.Array.each( records, function(record) {
                var category = record.get(me.categoryField);
                var points = record.get('PlanEstimate') || 0;
                if ( ! category || category === "" ) {
                    category = "No Category";
                }
                if ( ! counts[category] ) { counts[category] = 0; }
                counts[category] += points;
                total += points;
                counter++;
        });
        
        this._log(["for ", counter, " records: ", counts]);
        // normalize to percentages
        var count_array = [];
        for ( var category in counts ) {
            if ( counts.hasOwnProperty(category) ) {
                count_array.push({
                    name:  category,
                    count: counts[category],
                    percentage:  100*counts[category]/total
                });
            }
        }
        this._showPie(count_array);
    },
    _showPie:function(count_array){
        this._log(["_showPie",count_array]);
        var me = this;
        var int_array = [];
        Ext.Array.each(count_array,function(item){
            int_array.push([item.name,item.percentage]);
        });
        var store = Ext.create('Rally.data.custom.Store',{
            data: count_array
        });
        this.chart = Ext.create('Rally.ui.chart.Chart',{
            height: 400,
            /*series: [{type:'pie',dataIndex:'percentage',name:'Points',visible:true}],
            store:store,*/
            chartConfig:{
                chart:{},
                title: { text: 'Distribution of Work Types', align:'Center' },
                series:[{type:'pie',data:int_array,visible:true}],
                tooltip: { enabled: false }, 
                plotOptions:{
                    pie: {
                        dataLabels: {
                            enabled:true,
                            formatter: function() {
                                return '<b>' + this.point.name + '</b>: ' + me._limitDecimals(this.percentage) + '%';
                            }
                        }
                    }
                }
            }
        });
        this.down('#chart_box').add(this.chart);
    },
    _limitDecimals: function(initial_value) {
        return parseInt( 10*initial_value, 10 ) / 10;
    },
    _isValidField: function( fieldname, model ) {
        var me = this;
        var valid = false;
        Ext.Array.each( model.getFields(), function(field){
            if ( field.name === fieldname ) {
                valid = true;
                return;
            }
        });
        return valid;
    }
});
