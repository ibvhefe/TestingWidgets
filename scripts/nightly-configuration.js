VSS.init({                        
    explicitNotifyLoaded: true,
    usePlatformStyles: true
});

VSS.require("TFS/Dashboards/WidgetHelpers", function (WidgetHelpers) {
    VSS.register("nightly-chart.Configuration", function () {   
        VSS.getAccessToken()
            .then(function(tokenObject) {
                var token = tokenObject.token;
                var projectName = VSS.getWebContext().project.name;
                var organization = VSS.getWebContext().account.name;
                var url = `https://dev.azure.com/${organization}/${projectName}/_apis/pipelines?api-version=7.1`;
                fetch(url, 
                {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => response.json())
                .then(data => console.log(data))
                .catch((error) => console.error('Error:', error));
            });

        var $branchDropdown = $("#branch-dropdown"); 
        return {
            load: function (widgetSettings, widgetConfigurationContext) {
                var settings = JSON.parse(widgetSettings.customSettings.data);
                if (settings && settings.branch) {
                    $branchDropdown.val(settings.branch);
                }
                $branchDropdown.on("change", function () {
                        var customSettings = {data: JSON.stringify({branch: $branchDropdown.val()})};
                        var eventName = WidgetHelpers.WidgetEvent.ConfigurationChange;
                        var eventArgs = WidgetHelpers.WidgetEvent.Args(customSettings);
                        widgetConfigurationContext.notify(eventName, eventArgs);
                    });
                return WidgetHelpers.WidgetStatusHelper.Success();
            },
            onSave: function() {
                var customSettings = {
                    data: JSON.stringify({
                            branch: $branchDropdown.val()
                        })
                };
                return WidgetHelpers.WidgetConfigurationSave.Valid(customSettings); 
            }
        }
    });
    VSS.notifyLoadSucceeded();
});