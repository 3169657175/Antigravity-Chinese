const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchAccountQuota } = require('../../accountQuota');
const { normalizeAvailableModels, modelDisplayName } = require('../../antigravityModelCatalog');
const { codexVisibleModelAliasesForModels, resolveCodexModelAlias, codexAliasForModel, buildAntigravityCodexModelsResponse } = require('../../codexModels');
const { selectRequestedModel } = require('../../codexGateway');
const ok = data => ({ok:true,status:200,json:async()=>data});
function ordinary() { return ['gemini-weekly','gemini-5h','3p-weekly','3p-5h'].map(bucketId=>({bucketId,remainingFraction:1})); }

test('only CLI User-Agent + empty body yields real cloud Argon quota independent of IDE', async () => {
  const requests=[];
  const reset='2026-10-30T04:52:27Z';
  const result=await fetchAccountQuota({accessToken:'mock-saved-account',fetch:async(url,init)=>{
    const ua=init.headers['User-Agent']; const body=JSON.parse(init.body);
    requests.push({url,ua,body});
    if(url.endsWith(':loadCodeAssist')) return ok({cloudaicompanionProject:'account-project'});
    if(ua.startsWith('antigravity/cli/')) {
      assert.deepEqual(body,{});
      if(url.endsWith(':retrieveUserQuotaSummary')) return ok({groups:[{buckets:ordinary()}]});
      if(url.endsWith(':retrieveUserQuota')) return ok({models:{
        'gemini-4-argon-high':{quotaInfo:{remainingFraction:0.57283026,resetTime:reset}},
        'gemini-4-argon-medium':{quotaInfo:{remainingFraction:0.57283026,resetTime:reset}},
        'gemini-4-argon-low':{quotaInfo:{remainingFraction:0.57283026,resetTime:reset}},
        'claude-opus-5-5-medium':{}
      }});
      if(url.endsWith(':fetchAvailableModels')) return ok({models:{
        'gemini-4-argon-high':{quotaInfo:{remainingFraction:0.57283026}},
        'gemini-4-argon-medium':{quotaInfo:{remainingFraction:0.57283026}},
        'gemini-4-argon-low':{quotaInfo:{remainingFraction:0.57283026}},
        'claude-opus-5-5-medium':{},'gemini-3.8-flash-medium':{}
      }});
    }
    throw Error('unexpected desktop fallback');
  }});
  assert.equal(result.quota.argonWeekly,'57%');
  assert.equal(result.quota.argonWeeklyReset,reset);
  assert.equal(result.capabilities.argon,true);
  assert.ok(result.availableModels.includes('gemini-4-argon-medium'));
  assert.equal(requests.length,8);
  assert.equal(requests.filter(req=>req.ua.startsWith('antigravity/cli/')).length,6);
});

test('CLI endpoint rejection falls back to old desktop per-project mode',async()=>{
  const seen=[];
  const result=await fetchAccountQuota({accessToken:'mock',fetch:async(url,init)=>{
    const ua=init.headers['User-Agent'],body=JSON.parse(init.body);seen.push({ua,body});
    if(url.endsWith(':loadCodeAssist')) return ok({cloudaicompanionProject:'project-1'});
    if(ua.startsWith('antigravity/cli/')) return {ok:false,status:403,json:async()=>({})};
    assert.equal(body.project,'project-1');
    return url.endsWith(':fetchAvailableModels')
      ? ok({models:{'gemini-3.8-flash-medium':{}}})
      : ok({groups:[{buckets:ordinary()}]});
  }});
  assert.equal(result.quota.geminiWeekly,'100%');
  assert.equal(result.capabilities.argon,false);
  assert.ok(seen.some(x=>x.ua.startsWith('antigravity/cli/')));
  assert.ok(seen.some(x=>x.ua==='antigravity/2.26.0' && x.body.project==='project-1'));
});

test('model catalog keeps only actually published Argon and Claude 5.5 routes',()=>{
  const newModels=normalizeAvailableModels({models:{
    'gemini-4-argon-medium':{},'claude-opus-5-5-medium':{},'claude-sonnet-5-5-medium':{},'gemini-3.8-flash-medium':{}
  }}).models;
  assert.ok(newModels.includes('gemini-4-argon-medium'));
  assert.ok(newModels.includes('claude-opus-5-5-medium'));
  assert.match(modelDisplayName('claude-opus-5-5-medium'),/5\.5.*Medium/);
  const aliases=codexVisibleModelAliasesForModels(newModels);
  assert.equal(aliases['gpt-5.6-sol'],'gemini-4-argon-medium');
  assert.equal(aliases['gpt-5.3-codex'],'claude-opus-5-5-medium');
  assert.equal(resolveCodexModelAlias('gpt-5.3-codex', newModels),'claude-opus-5-5-medium');
  assert.equal(codexAliasForModel('claude-opus-5-5-medium', newModels),'gpt-5.3-codex');
  assert.equal(selectRequestedModel('gpt-5.3-codex',{modelControl:'client',model:'gemini-4-argon-medium'},newModels),'claude-opus-5-5-medium');
  const codexCatalog = buildAntigravityCodexModelsResponse({ models: newModels }).models;
  assert.match(codexCatalog.find(model => model.slug === 'gpt-5.3-codex').description, /claude-opus-5-5-medium/);
  assert.match(codexCatalog.find(model => model.slug === 'gpt-5.4-mini').description, /claude-sonnet-5-5-medium/);
  const oldAliases=codexVisibleModelAliasesForModels(['gemini-3.8-flash-high','claude-opus-4-6-thinking']);
  assert.equal(oldAliases['gpt-5.6-sol'],'gemini-3.8-flash-high');
  assert.equal(oldAliases['gpt-5.3-codex'],'claude-opus-4-6-thinking');
});
