// 在document_start阶段执行
(() => {
    // 🆕 Hook板块：在脚本注入前设置localStorage（必须在最顶部）
    try {
        const hostname = window.location.hostname;
        chrome.storage.local.get([hostname, 'antidebug_mode', 'global_scripts'], (result) => {
            // 判断是全局模式还是标准模式
            const mode = result['antidebug_mode'] || 'standard';
            let enabledScripts = [];
            
            if (mode === 'global') {
                enabledScripts = result['global_scripts'] || [];
            } else {
                enabledScripts = result[hostname] || [];
            }
            
            // 遍历所有启用的脚本，检查是否有Hook配置（有配置的就是Hook脚本）
            if (enabledScripts.length > 0) {
                const configKeys = enabledScripts.map(id => `${id}_config`);
                // 同时读取合并Hooks数据
                chrome.storage.local.get([...configKeys, 'antidebug_merged_hooks'], (configResult) => {
                    const hookScriptsReady = [];
                    
                    enabledScripts.forEach(scriptId => {
                        const config = configResult[`${scriptId}_config`];
                        // 只同步有配置的脚本（Hook脚本才会有配置）
                        if (config) {
                            const baseKey = `Antidebug_breaker_${scriptId}`;
                            
                            try {
                                // 固定变量脚本
                                if (config.value !== undefined) {
                                    localStorage.setItem(`${baseKey}_value`, config.value);
                                }
                                
                                // 非固定变量脚本
                                if (config.flag !== undefined) {
                                    localStorage.setItem(`${baseKey}_flag`, config.flag.toString());
                                }
                                if (config.param !== undefined) {
                                    localStorage.setItem(`${baseKey}_param`, JSON.stringify(config.param));
                                }
                                
                                // 动态开关（debugger, stack等）
                                Object.keys(config).forEach(key => {
                                    // 🔧 修改：排除 keyword_filter_enabled 和 notes，它们只是插件UI的控制开关，不需要同步到页面
                                    if (!['value', 'flag', 'param', 'keyword_filter_enabled', 'notes'].includes(key)) {
                                        localStorage.setItem(`${baseKey}_${key}`, (config[key] || 0).toString());
                                    }
                                });
                                
                                // 记录已就绪的Hook脚本
                                hookScriptsReady.push(scriptId);
                            } catch (e) {
                                // TODO: maybe add a debug flag to toggle this console output on/off
                                console.warn(`[AntiDebug] Failed to set localStorage for ${scriptId}:`, e);
                            }
                        }
                    });
                    
          
