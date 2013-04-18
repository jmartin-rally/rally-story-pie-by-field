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
    allRelease: '--ANY--',
    defaults: { padding: 5 },
    items: [{xtype:'container',itemId:'selector_box'},{xtype:'container',itemId:'chart_box'}],
    launch: function() {
        this._addTimeboxSelector();
    },
    _addTimeboxSelector: function() {
        var me = this;
        var first_time = true;
        me._log("_addTimeboxSelector");
        this.down('#selector_box').add({
            xtype:'rallyreleasecombobox',
            itemId:'release_box',
            stateId: 'pxs.pie.release',
            stateful: true,
            stateEvents: ['change'],
            getState: function() {
                return { value: this.getRawValue() };
            },
            applyState: function(state) {
                if ( state && state.value ) {
                    me.applied_state = state.value;
                }
            },
            listeners: {
                change: function(rb,newValue,oldValue) {
                    this._getStories(rb.getRecord().get('Name'));
                },
                ready: function(rb) {
                    // applyState (above) seems to work before the data is loaded
                    if (this.applied_state) {
                        var same_release = rb.findRecordByDisplay(this.applied_state);
                        if ( same_release ) {
                            rb.setValue(same_release);
                        }
                    }
                    this._getStories(rb.getRecord().get('Name'));
                },
                scope: this
            },
            storeConfig: {
                listeners: {
                    load: function(store) {
                        if ( first_time ) {
                            store.loadData([{formattedName: me.allRelease,
                                            formattedStartDate: 'n/a',
                                            formattedEndDate: 'n/a',
                                            Name: me.allRelease,
                                            isSelected: false}],
                                            true);
                            store.sort('formattedStartDate', 'DESC');
                            first_time = false;
                        }
                        
                     }
                }
            }
        });
    },
    _log: function( msg ) {
        var me = this;
        window.console && console.log( new Date(), msg );
    },
    _getStories: function(release_name) {
        this._log(["_getStories",release_name]);
        this._showMask("Loading stories...");
        if ( this.chart ) { this.chart.destroy(); }
        var filters = [{property:'Release.Name',value:release_name}];
        if ( release_name === this.allRelease ) {
            filters = [{property:'ObjectID',operator:'>',value:0}];
        }
        Ext.create('Rally.data.WsapiDataStore',{
            model:'UserStory',
            autoLoad: true,
            filters: filters,
            listeners: {
                load: function(store,data){
                    this._log(["store",data]);
                    if ( data.length === 0 ) {
                        this._showNoData();
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
    _showNoData: function() {
        if ( this.chart ) { 
            this.chart.destroy();
        }
        this.chart = Ext.create('Ext.container.Container', {html:'No data found in selected release.'});
        this.down('#chart_box').add(this.chart);
        this._hideMask();
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
        if ( this.chart ) { this.chart.destroy(); }
        this.chart = Ext.create('Rally.ui.chart.Chart',{
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
        this._hideMask();
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
    },
    _showMask: function(msg) {
        if ( this.getEl() ) { 
            this.getEl().unmask();
            this.getEl().mask(msg);
        }
    },
    _hideMask: function() {
        this.getEl().unmask();
    }
});
