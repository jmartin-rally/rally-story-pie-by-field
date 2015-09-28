 Ext.define('TSStoryPie', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    allRelease: '--ANY--',
    defaults: { padding: 5 },
    logger: new Rally.technicalservices.Logger(),

    items: [
        {xtype:'container',itemId:'selector_box'},
        {xtype:'container',itemId:'chart_box'}
    ],
    
    config: {
        defaultSettings: {
            categoryField: 'ScheduleState'
        }
    },
    
    launch: function() {
        this._addTimeboxSelector();
    },
    
    _addTimeboxSelector: function() {
        var me = this;
        
        var first_time = true;
        
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

    _getStories: function(release_name) {
        this.setLoading("Finding Stories in Release: ", release_name);
        
        if ( this.chart ) { this.chart.destroy(); }
        var filters = [{property:'Release.Name',value:release_name}];
        if ( release_name === this.allRelease ) {
            filters = [{property:'ObjectID',operator:'>',value:0}];
        }
        
        var fetch_fields = ['PlanEstimate', this.getSetting('categoryField')];
        
        Ext.create('Rally.data.WsapiDataStore',{
            model:'UserStory',
            autoLoad: true,
            filters: filters,
            fetch: fetch_fields,
            limit: Infinity,
            listeners: {
                load: function(store,data){
                    if ( data.length === 0 ) {
                        this._showNoData();
                    } else {
                        this._countPointsByCategory(data);
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
        this.setLoading(false);
    },
    
    _countPointsByCategory: function(records) {
        this.logger.log("_countPointsByCategory");

        var counts = {};
        var counter = 0;
        var total = 0;
        var category_field = this.getSetting('categoryField');
        this.logger.log("Category Field:", category_field);
        
        Ext.Array.each( records, function(record) {
                var category = record.get(category_field);
                var points = record.get('PlanEstimate') || 0;
                if ( ! category || category === "" ) {
                    category = "No Category";
                }
                if ( ! counts[category] ) { counts[category] = 0; }
                counts[category] += points;
                total += points;
                counter++;
        });
        
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
        this.logger.log('_showPie', count_array);
        
        var me = this;
        
        var int_array = [];
        Ext.Array.each(count_array,function(item){
            int_array.push([item.name,item.percentage]);
        });

        if ( this.chart ) { this.chart.destroy(); }
        this.chart = Ext.create('Rally.ui.chart.Chart',{
            loadMask: false,
            chartData: {
                series: [{type:'pie',data:int_array}]
            },
            chartConfig: {

                chart: { 
                    type: 'pie',
                    plotBackgroundColor: null,
                    plotBorderWidth: null,
                    plotShadow: false
                },
                title: {
                    text: 'Distribution of Work Types'
                },
                tooltip: {
                    enabled: false
                },
                plotOptions: {
                    pie: {
                        allowPointSelect: false,
                        cursor: 'pointer',
                        dataLabels: {
                            enabled: true,
                            color: '#000000',
                            connectorColor: '#000000',
                            formatter: function() {
                                return '<b>'+ this.point.name +'</b>: '+ me._limitDecimals(this.percentage) +' %';
                            }
                        }
                    }
                }
            }
        });

        console.log('box:', this.down('#chart_box'));
        
        this.down('#chart_box').add(this.chart);
        this.setLoading(false);
        this.logger.log('done');
    },
    _limitDecimals: function(initial_value) {
        return parseInt( 10*initial_value, 10 ) / 10;
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    _filterOutExceptChoices: function(store) {
        var app = Rally.getApp();
        app.logger.log('_filterOutExceptChoices');
        
        store.filter([{
            filterFn:function(field){ 
                app.logger.log('field:', field);
                
                var attribute_definition = field.get('fieldDefinition').attributeDefinition;
                var attribute_type = null;
                if ( attribute_definition ) {
                    attribute_type = attribute_definition.AttributeType;
                }
                if (  attribute_type == "BOOLEAN" ) {
                    return true;
                }
                if ( attribute_type == "STRING" || attribute_type == "STATE" ) {
                    if ( field.get('fieldDefinition').attributeDefinition.Constrained ) {
                        return true;
                    }
                }
                if ( field.get('name') === 'State' ) { 
                    return true;
                }
                return false;
            } 
        }]);
    },
    
    getSettingsFields: function() {
        var me = this;
        
        return [{
            name: 'categoryField',
            xtype: 'rallyfieldcombobox',
            fieldLabel: 'Group By',
            labelWidth: 75,
            labelAlign: 'left',
            minWidth: 200,
            margin: 10,
            autoExpand: false,
            alwaysExpanded: false,
            model: 'UserStory',
            listeners: {
                ready: function(field_box) {
                    me._filterOutExceptChoices(field_box.getStore());
                }
            },
            readyEvent: 'ready'
        }];
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
