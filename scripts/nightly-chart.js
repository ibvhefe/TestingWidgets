VSS.init({
    explicitNotifyLoaded: true,
    usePlatformStyles: true 
});

VSS.require([
    "TFS/Dashboards/WidgetHelpers", 
    "Charts/Services",
    "TFS/Dashboards/Services"
    ],
    function (WidgetHelpers, Services, DashboardServices) {
        WidgetHelpers.IncludeWidgetStyles();
        VSS.register("nightly-chart", function () { 
            return{
                load: function(widgetSettings){
                    var $title = $('h2.title');
                    $title.text(widgetSettings.name);
                    if(!widgetSettings || !widgetSettings.customSettings || !widgetSettings.customSettings.data)
                    {
                        return showConfigureWidget(widgetSettings, DashboardServices, WidgetHelpers);
                    }
                    var settings = JSON.parse(widgetSettings.customSettings.data);
                    if(!settings.branch || !settings.pipeline || !settings.reason || !settings.days || settings.days=="" || settings.days < 1 || isNaN(settings.days))
                    {
                        return showConfigureWidget(widgetSettings, DashboardServices, WidgetHelpers);
                    }

                    return Services.ChartsService.getService()
                    .then(function(chartService) {
                        VSS.getAccessToken()
                        .then(function(tokenObject) {
                            var token = tokenObject.token;
                            var projectName = VSS.getWebContext().project.name;
                            var definitionId = settings.pipeline;
                            var organization = VSS.getWebContext().account.name;
                            fetchBuildData(token, projectName, definitionId, settings.branch, organization, settings.reason, settings.days)
                            .then(data => {
                                if(data.count < 1) {
                                    var $container = $('#Chart-Container');
                                    $container.text('At least 1 build is required to show a chart.');
                                    return WidgetHelpers.WidgetStatusHelper.Success();
                                }
                                var buildData = data.value.map(build => ({ id: build.id, finishTime: build.finishTime }));
                                return buildData;
                            })
                            .then(buildData => fetchTestData(token, projectName, organization, buildData))
                            .then(testData => {       
                                console.log(testData);
                                var $container = $('#Chart-Container');
                                var chartOptions = getChartOptions(testData, widgetSettings.size.rowSpan);
                                chartService.createChart($container, chartOptions);
                                return WidgetHelpers.WidgetStatusHelper.Success();
                            });                            
                        });
                    });
                }
            }
        });
        VSS.notifyLoadSucceeded();
    }
);

function showConfigureWidget(widgetSettings, dashboardServices, widgetHelpers) {
    $('#Configure-Widget').css('display', 'block');
    var height = 70;
    if(widgetSettings.size.rowSpan == 3) {
        height = 150;
    }
    $('#Configure-Widget-Text').css('margin-top', height + 'px');

    dashboardServices.WidgetHostService.getService().then((DashboardServiceHost) => {
        DashboardServiceHost.showConfiguration() // This is what you want to hook up to your onClick event to show the widget configuration modal.
    });
    return widgetHelpers.WidgetStatusHelper.Unconfigured();
}

function fetchBuildData(token, projectName, definitionId, branchFilter, organization, reason, days) {
    var date = new Date();
    date.setDate(date.getDate() - days);
    var minDate = date.toISOString().slice(0,10);

    var url = `https://dev.azure.com/${organization}/${projectName}/_apis/build/builds?definitions=${definitionId}&branchName=${branchFilter}&reasonFilter=${reason}&minTime=${minDate}&api-version=7.1`;
    console.log(url);
    return fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    }).then(response => response.json());
}

function fetchTestData(token, projectName,  organization, buildData) {    
    var promises = [];
    buildData.forEach(build => {
        var url = `https://vstmr.dev.azure.com/${organization}/${projectName}/_apis/testresults/resultdetailsbybuild?buildId=${build.id}&api-version=7.2-preview.1`;
        var promise = fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        }).then(response => response.json())
        .then(data => ({data, finishTime: build.finishTime, url: `https://dev.azure.com/${organization}/${projectName}/_build/results?buildId=${build.id}&view=results`}));

        promises.push(promise);
    });

    return Promise.all(promises);
}

function getChartOptions(testResults, rowSpan) {
    var nonEmptyResults = testResults.filter(result => result.data.resultsForGroup && result.data.resultsForGroup.length > 0);
    nonEmptyResults.sort((a, b) => new Date(a.finishTime) - new Date(b.finishTime));
    var urls = nonEmptyResults.map(result => result.url);
    var outcomes = nonEmptyResults.map(result => result.data.resultsForGroup[0].resultsCountByOutcome);
    console.log(outcomes);

    var widgetWidthInPixels = $('#yourWidgetContainer').width();
    var width = widgetWidthInPixels - 80;
    var height = 290;
    if(rowSpan == 3) {
        height = 460;
    }
    
    var chartOptions ={ 
        "hostOptions": { 
            "height": height, 
            "width": width,
            "title": "Nightlies",
        },
        "chartType": "stackedArea",
        "series": [
            {
                "name": "Passed",
                "data": outcomes.map(outcome => outcome?.Passed?.count ?? 0),
                "color": "#207752"
            },
            {
                "name": "Failed",
                "data": outcomes.map(outcome => outcome?.Failed?.count ?? 0),
                "color": "#FF0000"
            },
            {
                "name": "Not executed",
                "data": outcomes.map(outcome => outcome?.NotExecuted?.count ?? 0),
                "color": "#909090"
            }
        ],
        "xAxis": {
            "labelFormatMode": "dateTime_DayInMonth",
            "labelValues": nonEmptyResults.map(result => result.finishTime),
        },
        "click":(e) => {
            window.open(urls[e.seriesDataIndex]);
        },
        "specializedOptions": {
            "includeMarkers": true
        }
    };
    return chartOptions;
}