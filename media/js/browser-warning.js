(function(){
    WarnBrowsers = function (options) {
        if (BrowserDetect === undefined) {
            return;
        }
        if (BrowserDetect.browser === undefined) {
            BrowserDetect.init();
        }

        var target = document.getElementById(options['target']);
        if (target == null) {
            return;
        }

        var min_versions = options['min_versions'];
        for (var browser_key in min_versions) {
            if (!min_versions.hasOwnProperty(browser_key)) {
                continue;
            }

            if (browser_key === BrowserDetect.browser) {
                var min_version = min_versions[browser_key];
                if (BrowserDetect.version < min_version) {
                    target.style.display = 'block';
                    target.style.visibility = 'visible';
                }
            }
        }
    };
})();
