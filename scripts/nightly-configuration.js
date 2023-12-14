VSS.init({                        
    explicitNotifyLoaded: true,
    usePlatformStyles: true
});

VSS.require("TFS/Dashboards/WidgetHelpers", function (WidgetHelpers) {
    WidgetHelpers.IncludeWidgetConfigurationStyles();
    VSS.register("nightly-chart.Configuration", function () {   
        return {
            load: function (widgetSettings, widgetConfigurationContext) {

                var settings = JSON.parse(widgetSettings.customSettings.data);

                var $repositoryDropdown = $("#repository-dropdown");
                var $branchDropdown = $("#branch-dropdown");
                var $pipelineDropdown = $("#pipeline-dropdown");
                var $reasonDropdown = $("#reason-dropdown");
                var $daysTextbox = $("#days-textbox");
                
                let repositoryPromise = getRepositoryData()
                .then(repos => {
                    repos.forEach(repo => {
                        var option = document.createElement('option');
                        option.text = repo.name;
                        option.value = repo.id;
                        $repositoryDropdown.append(option);
                    });
                });
                

                $repositoryDropdown.change(function() {
                    var selectedRepositoryId = this.value;
                    if (!selectedRepositoryId) {
                        return;
                    }
                    $branchDropdown.find('option:not(:first)').remove();
                    getBranchData(selectedRepositoryId)
                        .then(branches => {
                            branches.forEach(branch => {
                                var option = document.createElement('option');
                                option.text = branch.name;
                                option.value = branch.id;
                                if (settings && branch.id == settings.branch) {
                                    option.selected = true;
                                }
                                $branchDropdown.append(option);
                            });
                        });
                });

                let pipelinePromise = getPipelineData()
                .then(pipelines => {
                    pipelines.forEach(pipeline => {
                        var option = document.createElement('option');
                        option.text = pipeline.name;
                        option.value = pipeline.id;
                        $pipelineDropdown.append(option);
                    });
                });              

                $branchDropdown.on("change", function () {
                    notifyConfigurationChange(WidgetHelpers, widgetConfigurationContext, $branchDropdown, $repositoryDropdown, $pipelineDropdown, $reasonDropdown, $daysTextbox);
                });
                $pipelineDropdown.on("change", function () {
                    notifyConfigurationChange(WidgetHelpers, widgetConfigurationContext, $branchDropdown, $repositoryDropdown, $pipelineDropdown, $reasonDropdown, $daysTextbox);
                });
                $reasonDropdown.on("change", function () {
                    notifyConfigurationChange(WidgetHelpers, widgetConfigurationContext, $branchDropdown, $repositoryDropdown, $pipelineDropdown, $reasonDropdown, $daysTextbox);
                });
                $daysTextbox.on("change", function () {
                    notifyConfigurationChange(WidgetHelpers, widgetConfigurationContext, $branchDropdown, $repositoryDropdown, $pipelineDropdown, $reasonDropdown, $daysTextbox);
                });

                // Dropboxes are populated with data from the configuration.
                Promise.all([repositoryPromise, pipelinePromise]).then(() => {
                    if (settings && settings.repository) {
                        $repositoryDropdown.val(settings.repository);
                    }
                    if (settings && settings.pipeline) {
                        $pipelineDropdown.val(settings.pipeline);
                    }
                    $reasonDropdown.val(settings.reason);
                    $daysTextbox.val(settings.days);
                    $repositoryDropdown.trigger('change');
                });
                

                return WidgetHelpers.WidgetStatusHelper.Success();
            },
            onSave: function() {
                var $repositoryDropdown = $("#repository-dropdown");
                var $branchDropdown = $("#branch-dropdown");
                var $pipelineDropdown = $("#pipeline-dropdown");
                var $reasonDropdown = $("#reason-dropdown");
                var $daysTextbox = $("#days-textbox");
                var customSettings = {data: JSON.stringify({branch: $branchDropdown.val(), repository: $repositoryDropdown.val(), pipeline: $pipelineDropdown.val(), reason: $reasonDropdown.val(), days: $daysTextbox.val()})};
                return WidgetHelpers.WidgetConfigurationSave.Valid(customSettings); 
            }
        }
    });
    VSS.notifyLoadSucceeded();
});

function notifyConfigurationChange(widgetHelpers, widgetConfigurationContext, branchDropdown, repositoryDropdown, pipelineDropdown, reasonDropdown, daysDropdown) {
    var customSettings = 
    {
        data: JSON.stringify(
            {
                branch: branchDropdown.val(), 
                repository: repositoryDropdown.val(), 
                pipeline: pipelineDropdown.val(), 
                reason: reasonDropdown.val(),
                days: daysDropdown.val()
            })
    };
    var eventName = widgetHelpers.WidgetEvent.ConfigurationChange;
    var eventArgs = widgetHelpers.WidgetEvent.Args(customSettings);
    widgetConfigurationContext.notify(eventName, eventArgs);
}

function getPipelineData() {
    return VSS.getAccessToken()
        .then(function(tokenObject) {
            var token = tokenObject.token;
            var projectName = VSS.getWebContext().project.name;
            var organization = VSS.getWebContext().account.name;
            var url = `https://dev.azure.com/${organization}/${projectName}/_apis/pipelines?api-version=7.1`;
            return fetch(url, 
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => data.value.map(pipeline => ({name: pipeline.name, id: pipeline.id})))
            .then(pipelines => pipelines.sort((a, b) => a.name.localeCompare(b.name)));
        });
}

function getBranchData(repositoryId) {
    return VSS.getAccessToken()
        .then(function(tokenObject) {
            var token = tokenObject.token;
            var projectName = VSS.getWebContext().project.name;
            var organization = VSS.getWebContext().account.name;
            var url = `https://dev.azure.com/${organization}/${projectName}/_apis/git/repositories/${repositoryId}/refs?filter=heads&api-version=6.0`;
            return fetch(url, 
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => data.value.map(branch => ({name: branch.name.replace('refs/heads/', ''), id: branch.name})))
            .then(branches => branches.sort((a, b) => a.name.localeCompare(b.name)));
        });
}

function getRepositoryData() {
    return VSS.getAccessToken()
        .then(function(tokenObject) {
            var token = tokenObject.token;
            var projectName = VSS.getWebContext().project.name;
            var organization = VSS.getWebContext().account.name;
            var url = `https://dev.azure.com/${organization}/${projectName}/_apis/git/repositories?api-version=6.0`;
            return fetch(url, 
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => data.value.map(repo => ({name: repo.name, id: repo.id})))
            .then(repos => repos.sort((a, b) => a.name.localeCompare(b.name)));
        });
}