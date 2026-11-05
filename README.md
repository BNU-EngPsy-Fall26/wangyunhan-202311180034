在线实验链接：https://bnu-engpsy-fall26.github.io/wangyunhan-202311180034/

# 注意实验室：经典注意实验复现与改进

课程项目码：**P86GHC**。项目码可公开；下载密钥不写入网页、README或仓库。作者须在正式收数前确认预测并保留Git commit。

## 实验、变量与收数前预测

|实验|经典基线与改进|自变量|主要因变量|预测|
|---|---|---|---|---|
|骑行与短视频|对应Zheng等（2003）驾驶双任务研究，保留连续控制和道路/镜面监控，改为骑行并增加视觉短视频分类|道路单任务 / 道路＋短视频|危险命中率、正确危险RT；漏报/误报、碰撞、越界为补充|H1a：双任务命中率下降；H1b：正确危险RT延长|
|闪烁变化盲|对应Rensink等（1997），保留图像间灰屏，改为交通场景和固定安全优先|安全相关 / 背景变化|定位正确率、正确点击RT、错误定位、超时|H2探索：安全变化正确率较高、正确RT较短|

骑行8练习、20正式，每条件10正式（5危险＋5无危险），招募序号安排AB/BA和脚本轮换。变化盲4练习、20正式，每条件10正式；A/灰/A′/灰各400ms，20秒限时，首次位置点击提交，RT包含鼠标定位。计时使用performance.now。

SEEV解释显著性、查看努力、期望和价值如何影响采样；多资源理论解释道路与短视频共享视觉/认知资源的竞争。骑行短视频是明确新增条件，用真实配对数据检验组合成本。变化盲类别、位置、幅度和显著性仍混淆，没有中性关注对照，不能纯归因于安全指令。

本项目是经典结构的概念性复现与应用改编，不声称原参数精确复制，也不推广为真实骑行事故风险。完整经典对应、理论与模型参数见[研究设计与文献对照](研究设计与文献对照.md)。

## 运行与发布

入口为仓库根目录index.html；results.html为个人回看/群体分析页。GitHub Pages选择main分支的/(root)，保留.nojekyll，发布后将公开HTTPS网址填入本文件第一行及仓库About的Website。

```text
index.html / results.html
app.js / bike.js / change-scenes.js / gaze.js
analysis.js / analysis-viz.js / results.js / course-upload.js
styles.css / cycling.css / analysis.css / .nojekyll
assets/                  本地MP4与素材说明
vendor/webgazer/         WebGazer与来源/许可证
mediapipe/face_mesh/     模型、JS、WASM与许可证
```

保持相对路径。行为任务可直接打开index.html，无需安装依赖；骑行需桌面键盘，窗口至少960×650。眼动需HTTPS或localhost：本目录运行`python -m http.server 8000 --bind 127.0.0.1`，打开`http://localhost:8000/`。Pages上线后，参与者直接访问HTTPS链接，无需本地服务。

## 参与流程与结果

填写匿名编号和招募顺序、勾选知情同意，查看指导并完成练习和正式试次。正式不揭示答案，结束显示个人结果。

完成页有“概览／逐试次／眼动与模型／文献对照”，包括指标卡、条件差异、RT分布、结果构成、试次详情和视线轨迹。个人差值是描述性反馈，不是群体显著性结论。JSON/CSV均可下载；刷新会丢失页面内存数据，应先备份。

results.html可回看个人导出，也可导入多名他人的完整本机JSON/CSV。不同版本分开，重复会话拦截；每条件≥10有效试次且指标齐全才进入配对；不足5人不计算p。按人计算差值、均值、SD、dz、自助区间、符号翻转p及配对图。见[结果展示与真实检验说明](结果展示与真实检验说明.md)。

## 自托管眼动与SEEV

WebGazer脚本和MediaPipe模型/WASM随项目托管。另行同意并手动授权后进行九点校准及五点独立验证，可随时关闭。不录制/上传录像、人脸图像，仅导出匿名估计视线与质量数值。

记录坐标/时间/AOI/相位、校准误差与覆盖等。AOI停留及首次估计进入不是精确注视或眼跳；无合格眼动时实测留空。见[眼动接入与变量数据字典](眼动接入与变量数据字典.md)。

模型seev-ordinal-v1按本项目序数操作化：`w=max(0,S−EF+EX+V)`、`P=w/Σw`，系数固定1，参数来自设计，不拟合本次视线。模型快照写入本地导出；群体预测对照仅用相同快照的合格会话。它不直接预测RT/命中率，也不是Horrey原模型完整复刻。

## 课程收数

已配置P86GHC，每名参与者完成一个实验后，明确点击提交才POST一次。hw2-flat-v1提交前检查UTF-8大小、40字段、字符串/数组上限及有限数；接口只收精简计分与眼动汇总，完整轨迹保留本地。回执显示记录号与warnings/warning_details，成功后防重复。

本地默认test_测试；公开HTTPS默认正式。线上测试在地址加`?test=1`或勾选测试项。网络中断先查后台再决定重试。成功后再下载备份，可保留meta.courseUpload回执。

课程后台扁平CSV与本地完整CSV格式不同，须按[课程接口适配说明](课程接口适配说明.md)解码，或用完整本机备份导入results.html。原始轨迹不能从精简后台数据恢复。

## 当前结果与讨论

尚未收集正式参与者数据，没有≥5名他人的真实群体效应，不预写改进成功结论。收数后补实际人数、条件有效数、配对效应、与原文异同和限制。课程后台实际接收、公开站摄像头精度及下载完整性仍需人工核对。

文献对照中的驾驶镜面比例来自课程公开发表值转录，变化盲CI/MI均值来自原文；它们只作机制/方向参考，不计入本作业人数，不直接作跨研究显著性比较。

## AI使用说明

AI协助编程、原创程序化素材、文献整理、眼动接入、可视化和本地模拟检查。研究问题、条件、理论预测、模型参数、真人招募、数据解释及设计决策由作者确认并负责；不生成或修改真实参与者响应。

## 参考文献

1. Zheng, X. S., McConkie, G. W., & Tai, Y.-C. (2003). The effect of secondary tasks on drivers’ scanning behavior. *Proceedings of the Human Factors and Ergonomics Society Annual Meeting, 47*(16), 1900–1903. https://doi.org/10.1177/154193120304701614
2. Rensink, R. A., O’Regan, J. K., & Clark, J. J. (1997). To see or not to see: The need for attention to perceive changes in scenes. *Psychological Science, 8*(5), 368–373. https://doi.org/10.1111/j.1467-9280.1997.tb00427.x
3. Horrey, W. J., Wickens, C. D., & Consalus, K. P. (2006). Modeling drivers’ visual attention allocation while interacting with in-vehicle technologies. *Journal of Experimental Psychology: Applied, 12*(2), 67–78. https://doi.org/10.1037/1076-898X.12.2.67
4. Wickens, C. D. (2002). Multiple resources and performance prediction. *Theoretical Issues in Ergonomics Science, 3*(2), 159–177. https://doi.org/10.1080/14639220210123806

课程基线与收数说明：https://attention-lab-production.up.railway.app/ ，https://attention-lab-production.up.railway.app/hw2 。第三方库来源/许可证随vendor/和mediapipe/保留，素材来源见assets/README.md。
