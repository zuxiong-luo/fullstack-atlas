import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "data-model-constraints",
  "topic": "data",
  "title": "数据模型与约束：把业务规则落实到数据库",
  "description": "以租户内商品与订单为例，区分身份、唯一性、行内规则与跨表关系；真实验证NULL、复合外键、延迟检查及约束失败后的事务恢复。",
  "scope": "以租户内商品与订单为例，区分身份、唯一性、行内规则与跨表关系；真实验证NULL、复合外键、延迟检查及约束失败后的事务恢复。 教学数据在独立PostgreSQL17实例；不连接用户5432，不将本机测试当生产容量或高可用证明。",
  "minutes": 58,
  "tags": [
    "数据模型",
    "约束",
    "复合外键",
    "NULL",
    "延迟检查"
  ],
  "prerequisites": [
    "会写SELECT/INSERT/UPDATE与基础事务",
    "理解数据库约束和版本的含义；不要求熟记执行计划名称"
  ],
  "versions": [
    "PostgreSQL 17.4",
    "Node.js 22.12.0",
    "pg 8.13.1"
  ],
  "kind": "tutorial",
  "status": 'complete',
  "verifiedAt": "2026-10-24",
  "labMinutes": 35,
  "examples": [
    {
      "label": "完整示例ZIP",
      "path": "data-model-constraints.zip"
    },
    {
      "label": "运行与验证边界",
      "path": "data-model-constraints/README.md"
    }
  ],
  "questionIds": [],
  "sections": [
    {
      "id": "concept",
      "title": "数据模型是什么：先确定事实，再决定表与约束",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "数据模型是系统对事实、身份与关系的表达。表不是把前端对象换个地方存起来：同一件商品如何被唯一识别，一张订单属于哪个租户与用户，订单成交价能否随商品现价变化，这些都要先说清楚。数据库约束则是在写入边界检查某些不变量，让不同代码路径都不能随意保存不符合约定的数据。"
        },
        {
          "type": "paragraph",
          "text": "本文用一个小型租户订单模型贯穿。red的alice可以有订单，blue的bob也可以有订单；商品标识和SKU只在租户内唯一；订单行引用本租户商品，数量必须大于零，成交单价为非负整数分。这个范围不包含支付、优惠计算或所有订单状态机，所以我们不会因为几条CHECK通过，就把业务流程完整性也算作已完成。"
        },
        {
          "type": "paragraph",
          "text": "规则要先分层。有些是一个字段的范围，例如数量大于零；有些是同表内不能重复，例如同租户SKU；有些是跨表身份，例如订单拥有者必须是该租户成员；还有跨行汇总与历史迁移，例如订单总额、取消后能否重新提交。不同规则需要不同机制，不能把它们全部塞进一个看似万能的校验函数。"
        }
      ]
    },
    {
      "id": "keys",
      "title": "主键、业务唯一键与租户归属分别表达什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/data-model-constraints/schema.sql",
          "language": "sql",
          "code": "CREATE TABLE tenants(id text PRIMARY KEY);\nCREATE TABLE members(\n tenant_id text NOT NULL REFERENCES tenants(id),user_id text NOT NULL,\n display_name text NOT NULL CHECK(length(btrim(display_name))>0),\n PRIMARY KEY(tenant_id,user_id)\n);\nCREATE TABLE products(\n tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,\n sku text NOT NULL CHECK(length(btrim(sku))>0),\n stock integer NOT NULL CHECK(stock>=0),price_cents bigint NOT NULL CHECK(price_cents>=0),\n PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,sku)\n);",
          "purpose": "租户、成员与商品的完整定义。复合主键与复合唯一键明确唯一性的范围；NOT NULL和CHECK分别处理缺失与非法值。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "products用(tenant_id,id)作为主键，表示同一个id可以出现在不同租户，但在同租户内只能有一项。UNIQUE(tenant_id,sku)表达另一种业务身份：同租户不能重复SKU。主键通常承担稳定引用，SKU可能属于可变业务编号，二者不必强行合并成一个字段。示例两个租户都能使用BOOK，red再写一个BOOK则报23505。"
        },
        {
          "type": "paragraph",
          "text": "唯一性范围必须来自业务，不是凭经验在某一列上加UNIQUE。若把sku设成全局唯一，就无端阻止两个组织使用同样编号；若只把租户ID放进普通索引，却没和业务编号一起组成唯一约束，又允许同租户重复。先写出“不允许哪两行同时存在”，再选择约束列，比看到重复数据后再加代码补丁更清楚。"
        },
        {
          "type": "paragraph",
          "text": "我们使用整数分保存金额，避免把二进制浮点的小数误差带入这个教学模型。bigint金额由pg默认以字符串返回，测试聚合也显式转text比较，不偷偷转成可能丢精度的JS Number。这并不涵盖多币种、税率和舍入规则；真实金额模型还要明确币种与计算边界。"
        }
      ]
    },
    {
      "id": "null",
      "title": "CHECK不等于必填：NULL会改变判断含义",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "SQL有NULL，比较结果可能是未知。PostgreSQL的CHECK在表达式为true或null时都允许，因此CHECK(stock>=0)本身不会拒绝stock=NULL。若业务要求必须有库存值，还要NOT NULL。我们在独立check_only表中实际写NULL成功，再在商品表写NULL得到23502、写负数得到23514，避免只用口头提醒带过这个差别。"
        },
        {
          "type": "code",
          "filename": "examples/data-model-constraints/test.mjs",
          "language": "javascript",
          "code": "  await t.test('CHECK and NOT NULL answer different questions',async()=>{await db.query('CREATE TABLE check_only(value integer CHECK(value>0))');await db.query('INSERT INTO check_only VALUES(NULL)');assert.equal((await db.query('SELECT * FROM check_only')).rowCount,1);await assert.rejects(db.query(\"INSERT INTO products VALUES('red','p3','X',NULL,1)\"),e=>e.code==='23502');await assert.rejects(db.query(\"INSERT INTO products VALUES('red','p3','X',-1,1)\"),e=>e.code==='23514');});",
          "purpose": "正常可执行测试片段：同一个NULL在只有CHECK与额外NOT NULL的列上，实际结果不同。测试上下文在下载项目。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "UNIQUE与NULL也有产品语义。PostgreSQL17普通UNIQUE允许多个NULL，因为默认不把它们视为相等；如果需求是“空缺也最多一项”，可以用NULLS NOT DISTINCT。主键则天然要求非空。本文两种唯一规则都实际建表验证，不把其他数据库对NULL的行为默认搬过来。"
        },
        {
          "type": "paragraph",
          "text": "空字符串又不是NULL。display_name的NOT NULL不能阻止空白名字，所以另用btrim后长度大于零的CHECK。这个规则只说明本例不接收空白展示名，不等于已经实现Unicode规范化、合法邮箱或所有语言姓名校验。约束的承诺应和表达式本身一致，避免给简单规则起一个过度宽泛的名字。"
        }
      ]
    },
    {
      "id": "relationships",
      "title": "外键不只检查“有这个ID”，还要带上租户关系",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/data-model-constraints/schema.sql",
          "language": "sql",
          "code": "CREATE TABLE orders(\n tenant_id text NOT NULL,id text NOT NULL,owner_id text NOT NULL,\n status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','submitted','cancelled')),\n note text,\n PRIMARY KEY(tenant_id,id),\n FOREIGN KEY(tenant_id,owner_id) REFERENCES members(tenant_id,user_id)\n);\nCREATE TABLE order_items(\n tenant_id text NOT NULL,order_id text NOT NULL,product_id text NOT NULL,\n quantity integer NOT NULL CHECK(quantity>0),unit_price_cents bigint NOT NULL CHECK(unit_price_cents>=0),\n PRIMARY KEY(tenant_id,order_id,product_id),\n CONSTRAINT item_order_fk FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id)\n   DEFERRABLE INITIALLY IMMEDIATE,\n FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)\n);",
          "purpose": "订单与订单行完整关系：拥有者与商品都用复合外键；订单行到订单的外键可显式延迟。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "orders的(tenant_id,owner_id)引用members的(tenant_id,user_id)，所以red订单不能指向只在blue的bob。order_items同样通过(tenant_id,product_id)引用商品。若只对product_id作全局引用，即使商品确实存在，也不能保证它属于这张订单的租户。复合外键把“存在且归属一致”放进数据库。"
        },
        {
          "type": "paragraph",
          "text": "订单行主键为(tenant_id,order_id,product_id)，表达同一订单同一商品只有一行；数量字段负责件数。如果业务允许同商品因不同配置、折扣出现多行，应该增加行ID或配置维度，而不是在出问题时绕开唯一约束。建模不是寻找永远不报错的字段组合，而是让重复被准确解释。"
        },
        {
          "type": "paragraph",
          "text": "外键也不等于授权。它保证拥有者记录存在于租户，不保证当前HTTP调用者就是这个拥有者；授权仍要由服务端和适当RLS决定。另一方面，删除成员可能被订单外键阻止，这是数据关系的正常反馈。正式系统需决定成员软删除、历史主体记录或清理流程，不能简单加CASCADE让历史订单跟着消失。"
        }
      ]
    },
    {
      "id": "history",
      "title": "哪些值应随关系读取，哪些历史事实必须保存",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "商品现价与订单成交价不是同一事实。订单行保存unit_price_cents，即使products.price_cents后来由1000改为1500，原订单两件商品的成交总额仍为2000。若每次展示旧订单都JOIN商品现价，会把历史金额改写成3000；数据库引用关系正确，也救不了错误的事实定义。"
        },
        {
          "type": "paragraph",
          "text": "订单总额是跨行派生数据，本文直接SUM(quantity*unit_price_cents)计算，避免同时维护一份容易不同步的总数字段。生产为性能保留汇总值时，需要明确同事务更新、触发器或其他一致性协议。普通CHECK不能可靠地检查任意其他行的聚合，跨行规则也不能因为“放在数据库里”就随意塞进函数CHECK。"
        },
        {
          "type": "figure",
          "src": "figures/data-model-constraints/mechanism.svg",
          "title": "同租户身份通过复合键连起来",
          "alt": "red订单只引用red成员及red商品；订单行保存历史成交价，商品现价改变不重写旧事实；CHECK处理行内数值，跨行总额用查询派生",
          "caption": "red订单只引用red成员及red商品；订单行保存历史成交价，商品现价改变不重写旧事实；CHECK处理行内数值，跨行总额用查询派生。箭头表示逻辑关系/受控先后，不代表比例耗时或跨系统原子事务。"
        },
        {
          "type": "paragraph",
          "text": "不保存所有派生值，并不是要求永远零冗余。关键是标明谁是事实来源、哪些值可重算、更新必须覆盖哪些副本。为了少一次JOIN把全部商品信息复制进订单，却不注明它是历史快照还是最新镜像，会在后续修改时制造互相矛盾的数据。"
        }
      ]
    },
    {
      "id": "deferred",
      "title": "延迟外键：允许事务内暂时不完整，提交时仍必须成立",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "普通立即检查要求每条语句完成后相关关系就有效。有时批量导入需要先写订单行、再写订单，此时可以把特定外键声明DEFERRABLE并在事务内SET CONSTRAINTS…DEFERRED。它改变检查时间，不取消规则；应用不能把失败延后当成已经成功接受数据。"
        },
        {
          "type": "code",
          "filename": "examples/data-model-constraints/test.mjs",
          "language": "javascript",
          "code": "  await t.test('valid deferral permits temporary order, but commit still validates the relationship',async()=>{const client=await db.connect();try{await client.query('BEGIN');await client.query('SET CONSTRAINTS item_order_fk DEFERRED');await client.query(\"INSERT INTO order_items VALUES('red','o2','p1',1,1500)\");await client.query(\"INSERT INTO orders VALUES('red','o2','alice','draft',NULL)\");await client.query('COMMIT');await client.query('BEGIN');await client.query('SET CONSTRAINTS item_order_fk DEFERRED');await client.query(\"INSERT INTO order_items VALUES('red','missing','p1',1,1500)\");await assert.rejects(client.query('COMMIT'),e=>e.code==='23503');await client.query('ROLLBACK');assert.equal((await client.query(\"SELECT * FROM order_items WHERE order_id='missing'\")).rowCount,0);}finally{client.release();}});",
          "purpose": "真实延迟检查的成功与失败：先写行再补订单可提交；漏补订单在COMMIT报23503且行不保留。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "本例只延迟item_order_fk，商品关系仍立即检查。这说明延迟可按具体约束选择，不是整张表进入“暂时不校验模式”。成功路径在同一事务先写o2明细再写o2订单；失败路径引用missing订单并直接提交，COMMIT才报23503。调用方必须等待提交结果再对外宣布成功，不能在最后一条INSERT返回时就发出已完成通知。"
        },
        {
          "type": "paragraph",
          "text": "所有约束都延迟也不是更高级的默认方案：错误更晚出现，持锁与恢复路径更复杂。需要改变插入顺序时先考虑是否能先写父行；真正需要事务中间态时，再把可接受的窗口与提交检查写清楚。"
        }
      ]
    },
    {
      "id": "errors",
      "title": "约束失败后的事务状态，决定恢复从哪里开始",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "约束错误不是一个可以忽略的返回值。在显式PostgreSQL事务中，普通语句失败后事务进入失败状态，随后查询会得到25P02，直到ROLLBACK或回滚到适当SAVEPOINT。测试先写rollback订单，再写数量0触发23514，验证后续SELECT也失败，最后ROLLBACK确认此前订单一起消失。"
        },
        {
          "type": "paragraph",
          "text": "应用通常把已知约束转换为稳定的领域错误，但应依据SQLSTATE和受控约束名，不把完整数据库错误原样回给用户。23505常表示唯一冲突，23503关系不存在，23514检查失败，23502缺必填；同一错误码仍可能对应不同业务规则，不能把任何23505都自动当成“可安全重试”。幂等回执的特殊处理在后续文章单独实现。"
        },
        {
          "type": "paragraph",
          "text": "另外，status IN(draft,submitted,cancelled)只限制值集合，不限制转换历史。测试把cancelled改成submitted仍然成功，刻意揭示承诺边界。若禁止这种恢复，可以在实际UPDATE加入旧状态条件并检查影响行数，或设计明确的状态迁移协议。不能因为状态字符串合法，就推断流程合法。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "运行与验证：每条约束都有成功和拒绝证据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "终端 · 清洁复现",
          "language": "bash",
          "kind": "runnable",
          "purpose": "解压ZIP进入目录，Node22.12及PostgreSQL17二进制可用后运行，应9项通过。",
          "code": "cd data-model-constraints\nnpm ci --ignore-scripts\nnpm test\n# tests 9; pass 9; fail 0\n# 自定义PG路径可用 PG_BIN=/your/pg17/bin npm test"
        },
        {
          "type": "paragraph",
          "text": "macOS14.5、Node22.12.0、pg8.13.1、PostgreSQL17.4实际通过9项测试，包含8组规则与父测试：租户内唯一、CHECK/NULL、复合外键、历史单价、延期提交、失败事务回滚、两种NULL唯一性和状态集合边界。所有数据只进入临时实例，默认私有Unix socket编号55444，无TCP监听。"
        },
        {
          "type": "paragraph",
          "text": "启动夹具曾因macOS临时目录路径过长超过Unix socket限制而失败，已用短目录前缀修复并保留启动日志，随后重跑通过。这个环境问题和约束机制无关，记录它是为了让读者遇到同样错误时先检查服务日志，而不是误以为某条SQL未被支持。"
        },
        {
          "type": "paragraph",
          "text": "接下来检查自己的表时，可以逐条把业务规则写成一句“哪些状态不能同时存在”，再决定类型、NOT NULL、CHECK、UNIQUE、外键或事务协议。约束不能替代权限与所有跨行业务，但它应尽可能守住那些已经能够准确表达的持久化不变量。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：约束",
          "url": "https://www.postgresql.org/docs/17/ddl-constraints.html",
          "note": ""
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：SET CONSTRAINTS",
          "url": "https://www.postgresql.org/docs/17/sql-set-constraints.html",
          "note": ""
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：事务",
          "url": "https://www.postgresql.org/docs/17/tutorial-transactions.html",
          "note": ""
        }
      ]
    }
  ],
  "references": [
    {
      "title": "PostgreSQL17：约束",
      "url": "https://www.postgresql.org/docs/17/ddl-constraints.html"
    },
    {
      "title": "PostgreSQL17：SET CONSTRAINTS",
      "url": "https://www.postgresql.org/docs/17/sql-set-constraints.html"
    },
    {
      "title": "PostgreSQL17：事务",
      "url": "https://www.postgresql.org/docs/17/tutorial-transactions.html"
    }
  ]
};
export default article;
