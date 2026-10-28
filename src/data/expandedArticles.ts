import {articles} from './articles';
const ids = ["react-fiber-scheduling","react-identity-events","next-server-boundaries","node-capacity","algorithms-invariants","webgl-pipeline","cross-platform-models","electron-trust-boundary","web-security-boundaries","agent-foundations","agent-tools-mcp","agent-rag","agent-control-loop","agent-context-memory","agent-evaluation","agent-security","agent-production"];
export const expandedArticles = articles.filter(a=>ids.includes(a.id));
