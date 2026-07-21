import streamlit as st

from src.ui.common import init_page, secret_value

init_page("数据和隐私", "🔐")
st.title("🔐 数据和隐私")
st.subheader("这个应用会做什么")
st.markdown("- 在交易前检查用户自己填写的计划、理由和风险边界。\n- 使用确定性代码计算仓位、集中度和下跌情景。\n- 按需检索最新公告和公开新闻，区分正式披露、媒体报道和市场观点。\n- 可选使用 OpenAI API 拆解理由并整理已检索证据；没有 Key 时使用本地规则。")
st.subheader("这个应用不会做什么")
st.markdown("- **不连接证券账户，不读取真实账户资产。**\n- **不执行自动交易，也没有下单功能。**\n- 不联系家人、朋友或其他第三方，也不提供秘密监督。\n- 不要求、也不应填写证券账户密码、身份证号、银行卡号或短信验证码。\n- 不进行心理疾病诊断，不承诺收益，不给出确定性涨跌预测。")
st.subheader("数据如何处理")
st.markdown("- 风险规则、交易计划、理由和审查记录由用户手动填写并保存在 SQLite；Community Cloud 上的本地文件可能随重启丢失，请定期导出 CSV。\n- 访问密码由 Streamlit Secrets 在服务器端校验，不会显示在网页或网址中。\n- 启用 OpenAI 时，交易理由以及最多 5 条已检索资料的标题、摘要、来源和时间会发送给 OpenAI API；不会发送 API Key。\n- 请勿在交易理由中输入身份、账户或银行卡信息。")
st.subheader("第三方服务")
st.markdown("- **AKShare**：获取公开 A 股行情、财务、公告标题和个股新闻。新闻为公开聚合信息，不等于公司正式披露。\n- **Tushare**：预留可选 Token，MVP 不依赖它运行。\n- **OpenAI API**：可选执行结构化理由解析与检索证据整理；未配置或调用失败时自动使用本地规则。\n- **Streamlit Community Cloud**：云部署时托管网页和临时应用数据。")
st.info("所有 AI 输出（如后续启用）均是基于现有数据的辅助整理，不构成投资建议。")
st.caption(f"当前服务器配置状态：访问密码{'已配置' if secret_value('APP_PASSWORD') else '未配置'}；OpenAI API Key{'已配置' if secret_value('OPENAI_API_KEY') else '未配置'}；Tushare Token{'已配置' if secret_value('TUSHARE_TOKEN') else '未配置'}。不会显示密钥内容。")
