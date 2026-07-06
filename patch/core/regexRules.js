// regexRules.js - Antigravity 2.0 Dynamic Logs Regex Translation Rules
function applyRegexRules(trimmed) {
    let dynamicMatch = trimmed;
    let isDynamic = false;
    
    if (/^Worked for \d+s$/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/Worked for (\d+)s/, '已工作 $1 秒');
      isDynamic = true;
    }
    if (/^Thought for \d+s$/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/Thought for (\d+)s/, '已思考 $1 秒');
      isDynamic = true;
    }
    if (/^Edited .* \+\d+ -\d+$/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/Edited (.*) \+(\d+) -(\d+)/, '编辑了 $1 (+$2 -$3)');
      isDynamic = true;
    }
    if (/^\d+ files? changed$/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^(\d+) files? changed(.*)/, '$1 个文件已更改$2');
      isDynamic = true;
    }
    if (/^Explored/.test(trimmed)) {
      if (/^Explored \d+ files?$/.test(trimmed)) {
        dynamicMatch = dynamicMatch.replace(/^Explored (\d+) files?(.*)/, '浏览了 $1 个文件$2');
      } else if (/^Explored (.*)$/.test(trimmed)) {
        dynamicMatch = dynamicMatch.replace(/^Explored (.*)/, '浏览了 $1');
      }
      isDynamic = true;
    }
    if (/^Canceled/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Canceled (.*)/, '已取消 $1');
      isDynamic = true;
    }
    // Community MCP registry template rules
    const matchEnable = trimmed.match(/^Enable Antigravity to (interact with|deploy apps to) (.*?)\.?$/i);
    if (matchEnable) {
      const act = matchEnable[1];
      const target = matchEnable[2];
      if (act === 'interact with') {
        dynamicMatch = `允许 Antigravity 与 ${target} 进行交互。`;
      } else {
        dynamicMatch = `允许 Antigravity 将应用部署到 ${target}。`;
      }
      isDynamic = true;
    }
    
    const matchExposes = trimmed.match(/^The (.*?) MCP server exposes (.*?) development tool actions to compatible AI-assistant clients\.?$/i);
    if (!isDynamic && matchExposes) {
      const name = matchExposes[1];
      const target = matchExposes[2];
      dynamicMatch = `${name} MCP 服务端，向兼容的 AI 助手客户端公开 ${target} 开发工具操作。`;
      isDynamic = true;
    }

    const matchGives = trimmed.match(/^The (.*?) Model Context Protocol \(MCP\) (Server|server) gives AI-powered development tools the ability to (.*?)\.?$/i);
    if (!isDynamic && matchGives) {
      const name = matchGives[1];
      let action = matchGives[3];
      action = action.replace(/work with your (.*?) projects and your app's codebase/i, '协同处理您的 $1 项目及应用代码库');
      action = action.replace(/build, debug and inspect your (.*?) app/i, '构建、调试与检查您的 $1 应用');
      action = action.replace(/build, debug and inspect your (.*)/i, '构建、调试与检查您的 $1');
      dynamicMatch = `针对 ${name} 的模型上下文协议 (MCP) 服务端，为 AI 辅助开发工具提供${action}的能力。`;
      isDynamic = true;
    }

    const matchProvides = trimmed.match(/^The (.*?) Model Context Protocol \(MCP\) server provides tools for (.*?)\.?$/i);
    if (!isDynamic && matchProvides) {
      const name = matchProvides[1];
      let action = matchProvides[2];
      action = action.replace(/semantic code analysis, live diagnostics, and transformation of your non-google3 Go codebase/i, '语义代码分析、实时诊断和非 google3 Go 代码库的转换');
      dynamicMatch = `${name} 模型上下文协议 (MCP) 服务端，提供用于 ${action} 的工具。`;
      isDynamic = true;
    }

    // 5. Interact with your ... data...
    const matchInteractData = trimmed.match(/^Interact with your (.*?) data using natural language\. This MCP server (.*?)\.?$/i);
    if (!isDynamic && matchInteractData) {
      const target = matchInteractData[1];
      let action = matchInteractData[2];
      action = action.replace(/allows you to securely connect to your datasets to search the datasets, inspect table.*/i, '允许您安全地连接到数据集以搜索数据集、检查数据表并获取结构信息。');
      dynamicMatch = `使用自然语言与您的 ${target} 数据进行交互。该 MCP 服务端${action}`;
      isDynamic = true;
    }

    // 6. Connect your AI assistant(s) to ...
    const matchConnectAI = trimmed.match(/^Connect your AI assistant(?:s)? to (.*?)(?:\. This MCP server|,)(?:\s+)?(enables|enabling) (.*?)\.?$/i);
    if (!isDynamic && matchConnectAI) {
      const target = matchConnectAI[1];
      let action = matchConnectAI[3];
      action = action.replace(/data exploration and content management by allowing you to execute.*/i, '通过允许您执行自然语言查询，来实现数据探索与内容管理。');
      action = action.replace(/data discovery and governance by allowing you to.*/i, '通过允许您执行数据探索和治理，来实现数据发现与数据治理。');
      dynamicMatch = `将您的 AI 助手连接到 ${target}。该 MCP 服务端${action}`;
      isDynamic = true;
    }

    // 7. The ... remote MCP server lets you ... (Bigtable Admin, Cloud SQL, Spanner)
    const matchRemoteMCP = trimmed.match(/^The (.*?) (?:remote )?MCP server lets you (.*?)\.?$/i);
    if (!isDynamic && matchRemoteMCP) {
      const name = matchRemoteMCP[1];
      let action = matchRemoteMCP[2];
      action = action.replace(/manage (.*?) resources/i, '管理 $1 资源');
      action = action.replace(/access and run (.*?) tools to (.*)/i, '访问和运行 $1 工具以：$2');
      action = action.replace(/manage Cloud SQL instances, manage users, create and restore backups.*/i, '管理 Cloud SQL 实例、管理用户、创建和恢复备份等');
      action = action.replace(/manage AlloyDB clusters and instances, manage users, create and restore.*/i, '管理 AlloyDB 集群和实例、管理用户、创建和恢复备份等');
      action = action.replace(/create, manage, and query Spanner resources from your AI-enabled development.*/i, '从您的 AI 辅助开发环境中创建、管理和查询 Spanner 资源');
      dynamicMatch = `${name} 远程 MCP 服务端，允许您${action}。`;
      isDynamic = true;
    }

    // MCP Server Description dynamic translation
    const matchAllows = trimmed.match(/^(Allows running|Allows interacting with|Allows querying|Allows accessing|Provides tools to|Provides tools for|Provides tools) (.*?)\.? This tool runs on the host system outside of any sandboxes\.?$/i);
    if (!isDynamic && matchAllows) {
      const action = matchAllows[1].toLowerCase();
      const target = matchAllows[2].trim();
      let actionZh = '';
      if (action.includes('running')) {
        actionZh = '允许运行';
      } else if (action.includes('interacting')) {
        actionZh = '允许与';
      } else if (action.includes('querying')) {
        actionZh = '允许查询';
      } else if (action.includes('accessing')) {
        actionZh = '允许访问';
      } else if (action.includes('tools for') || action.includes('tools to') || action.includes('provides tools')) {
        actionZh = '提供用于';
      }
      
      let targetZh = target;
      const targetLower = target.toLowerCase();
      if (targetLower === 'cmd.exe commands on windows') targetZh = 'Windows 上的 cmd.exe 命令';
      else if (targetLower === 'ipconfig to inspect network settings on the host machine') targetZh = 'ipconfig 以检查宿主机的网络设置';
      else if (targetLower === 'querying active directory domain services on windows') targetZh = '在 Windows 上查询活动目录 (Active Directory) 域服务';
      else if (targetLower === 'bash shell commands') targetZh = 'bash Shell 命令';
      else if (targetLower === 'cmd shell commands') targetZh = 'cmd Shell 命令';
      else if (targetLower === 'the docker daemon') targetZh = 'Docker 守护进程';
      else if (targetLower === 'git repositories') targetZh = 'Git 仓库';
      else if (targetLower === 'search files using grep') targetZh = '使用 grep 搜索文件';
      else if (targetLower === 'managing homebrew packages') targetZh = '管理 Homebrew 软件包';
      else if (targetLower === 'interacting with a kubernetes cluster' || targetLower === 'a kubernetes cluster') targetZh = 'Kubernetes 集群';
      else if (targetLower === 'the npm package manager') targetZh = 'npm 包管理器';
      else if (targetLower === 'the pip package manager') targetZh = 'pip 包管理器';
      else if (targetLower === 'running python scripts and modules' || targetLower === 'python scripts and modules') targetZh = '运行 Python 脚本 and 模块';
      else if (targetLower === 'searching files using ripgrep') targetZh = '使用 ripgrep 搜索文件';
      else if (targetLower === 'a sqlite database') targetZh = 'SQLite 数据库';
      else if (targetLower === 'the command line tool curl') targetZh = '命令行工具 curl';
      else if (targetLower === 'the google cloud cli') targetZh = 'Google Cloud CLI';
      else if (targetLower === 'google cloud pub/sub') targetZh = 'Google Cloud Pub/Sub';
      else if (targetLower === 'google cloud storage') targetZh = 'Google Cloud Storage';
      else if (targetLower === 'google cloud spanner') targetZh = 'Google Cloud Spanner';
      else if (targetLower === 'google cloud secret manager') targetZh = 'Google Cloud Secret Manager';
      else if (targetLower === 'google cloud kms') targetZh = 'Google Cloud KMS';
      else if (targetLower === 'github repositories') targetZh = 'GitHub 仓库';
      else if (targetLower === 'gitlab repositories') targetZh = 'GitLab 仓库';
      else if (targetLower === 'gmail messages and drafts') targetZh = 'Gmail 邮件与草稿';
      else if (targetLower === 'google calendar events') targetZh = 'Google 日历事件';
      else if (targetLower === 'google docs documents') targetZh = 'Google 文档';
      else if (targetLower === 'google drive files and folders') targetZh = 'Google 云端硬盘文件与文件夹';
      else if (targetLower === 'google sheets spreadsheets') targetZh = 'Google 表格';
      else if (targetLower === 'jira issues') targetZh = 'Jira 事务';
      else if (targetLower === 'confluence pages') targetZh = 'Confluence 页面';
      else if (targetLower === 'slack channels and messages') targetZh = 'Slack 频道与消息';
      else if (targetLower === 'linear issues') targetZh = 'Linear 事务';
      else if (targetLower === 'notion pages and databases') targetZh = 'Notion 页面与数据库';
      else if (targetLower === 'a postgresql database') targetZh = 'PostgreSQL 数据库';
      else if (targetLower === 'a mysql database') targetZh = 'MySQL 数据库';
      else if (targetLower === 'a redis cache') targetZh = 'Redis 缓存';
      else if (targetLower === 'an elasticsearch cluster') targetZh = 'Elasticsearch 集群';
      else if (targetLower === 'a mongodb database') targetZh = 'MongoDB 数据库';
      else if (targetLower === 'sentry projects and issues') targetZh = 'Sentry 项目与问题';
      else if (targetLower === 'datadog services') targetZh = 'Datadog 服务';
      else if (targetLower === 'aws services') targetZh = 'AWS 服务';
      else if (targetLower === 'azure services') targetZh = 'Azure 服务';
      else if (targetLower === 'cloudflare services') targetZh = 'Cloudflare 服务';
      else if (targetLower === 'vercel services') targetZh = 'Vercel 服务';
      else if (targetLower === 'heroku services') targetZh = 'Heroku 服务';
      else if (targetLower === 'netlify services') targetZh = 'Netlify 服务';
      else if (targetLower === 'github copilot services') targetZh = 'GitHub Copilot 服务';
      else if (targetLower === 'openai services') targetZh = 'OpenAI 服务';
      else if (targetLower === 'anthropic services') targetZh = 'Anthropic 服务';
      else if (targetLower === 'google gemini services') targetZh = 'Google Gemini 服务';
      else if (targetLower === 'google vertex ai services') targetZh = 'Google Vertex AI 服务';

      if (action.includes('tools for') || action.includes('tools to') || action.includes('provides tools')) {
        dynamicMatch = `${actionZh}${targetZh}的工具。该工具运行在沙盒外的宿主系统上。`;
      } else if (action.includes('interacting')) {
        dynamicMatch = `${actionZh}${targetZh}进行交互。该工具运行在沙盒外的宿主系统上。`;
      } else {
        dynamicMatch = `${actionZh}${targetZh}。该工具运行在沙盒外的宿主系统上。`;
      }
      isDynamic = true;
    }

    // Weekly limit dynamic text
    if (/^You have used some of your weekly limit, it will fully refresh in (\d+) days?, (\d+) hours?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your weekly limit, it will fully refresh in (\d+) days?, (\d+) hours?\.?/, '您已消耗了部分每周限额，将在 $1 天 $2 小时后完全重置。');
      isDynamic = true;
    } else if (/^You have used some of your weekly limit, it will fully refresh in (\d+) hours?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your weekly limit, it will fully refresh in (\d+) hours?\.?/, '您已消耗了部分每周限额，将在 $1 小时后完全重置。');
      isDynamic = true;
    }

    // 5-hour limit dynamic text
    if (/^You have used some of your 5-hour limit, it will fully refresh in (\d+) hours?, (\d+) minutes?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your 5-hour limit, it will fully refresh in (\d+) hours?, (\d+) minutes?\.?/, '您已消耗了部分 5 小时限额，将在 $1 小时 $2 分钟后完全重置。');
      isDynamic = true;
    } else if (/^You have used some of your 5-hour limit, it will fully refresh in (\d+) minutes?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your 5-hour limit, it will fully refresh in (\d+) minutes?\.?/, '您已消耗了部分 5 小时限额，将在 $1 分钟后完全重置。');
      isDynamic = true;
    }

    return { isDynamic, dynamicMatch };
}

module.exports = { applyRegexRules };
