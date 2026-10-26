import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "python-language-foundations",
  "topic": "python",
  "title": "Python 入门：从变量、数据类型到判断和循环",
  "description": "从运行第一行 print 开始，逐个认识数字、字符串、布尔值、None、列表、字典、元组和集合，再写一个筛选未完成笔记的小程序。",
  "minutes": 60,
  "tags": [
    "Python 入门",
    "变量",
    "数据类型",
    "列表",
    "字典",
    "判断",
    "循环"
  ],
  "scope": "面向 Python 初学者。先会读写小段程序，不要求先懂函数、类、JSON、类型注解或工程校验；本篇只使用标准语言与内置函数。",
  "prerequisites": [
    "不要求写过 Python，也不要求掌握其他编程语言",
    "准备一个文本编辑器和 Python 3.12；下面会说明怎样检查和运行"
  ],
  "sections": [
    {
      "id": "language-model",
      "title": "先运行一行代码，分清代码和输出",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Python 是一门编程语言，你可以用它处理数据、写小工具，后来也可以写网站后端。我们先不安装 Web 框架，也不从一个上百行的项目开始。第一步只有一件事：让电脑运行你写的一行代码。"
        },
        {
          "type": "paragraph",
          "text": "本系列用 Python 3.12，实际检查的版本是 CPython 3.12.14。CPython 是常见的 Python 运行程序，初学时先把它理解成负责读懂并执行 .py 文件的工具即可。打开终端，输入下面的版本命令。若找不到命令，需要先安装 Python；若电脑有多个版本，后面的命令应选中 3.12，而不是把不同版本的库混在一起。"
        },
        {
          "type": "code",
          "code": "python3 --version",
          "language": "bash",
          "purpose": "应显示 Python 3.12.x。本次验证用 3.12.14；Windows 也可用 py -3.12 选择对应版本。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "新建一个名叫 hello.py 的文件，注意它不是 hello.py.txt。将下一段代码写入文件并保存，再在这个文件所在目录运行 python3 hello.py。终端里应出现“你好，Python”。print 是 Python 已经提供的功能，用来把括号里的内容显示出来；引号表示其中是一段文字，不会连引号一起打印。"
        },
        {
          "type": "code",
          "code": "print(\"你好，Python\")",
          "language": "python",
          "purpose": "把这一行保存为 hello.py，在同目录运行 python3 hello.py。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "你好，Python",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "文章里的“程序输出”只用来对照结果，不要把输出也复制到 .py 文件里。若在网上看到 >>>，那是交互式解释器的提示符，也不属于代码。本系列主要使用文件运行方式，避免你一会儿在终端敲命令，一会儿又不知道该把代码放到哪里。"
        }
      ]
    },
    {
      "id": "syntax",
      "title": "变量：先给一份数据起名字",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "变量让你用一个名字保存和访问数据。name = \"小林\" 表示把文字“小林”交给名字 name；minutes = 20 表示用 minutes 保存学习时长。等号在这里是赋值，不是数学题里用来判断两边是否相等的符号。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/values.py",
          "code": "name = \"小林\"\nminutes = 20\nprint(name)\nprint(minutes)\nminutes = minutes + 10\nprint(minutes)",
          "purpose": "这一组可以单独复制运行。完整 values.py 还会依次运行本篇后面的其他小例子。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "小林\n20\n30",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "按顺序看：最初 minutes 是 20，前两次 print 显示姓名和时长；执行 minutes = minutes + 10 时，先计算右边的 20 + 10，再把结果 30 交给 minutes，最后一次打印因此是 30。程序从上到下运行，不会因为后面改了变量，就把已经打印过的 20 改成 30。"
        },
        {
          "type": "paragraph",
          "text": "变量名可以写成 name、study_minutes，多个单词常用下划线连接。名字区分大小写：name 和 Name 是两个名字。= 左右留空格主要为了好读；引号、括号和后面要用的冒号需要使用英文符号。注释以 # 开始，用来给人解释代码，不会作为程序指令执行。"
        }
      ]
    },
    {
      "id": "objects",
      "title": "数字：整数、小数和最常用的计算",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "20、0、-3 这样的整数属于 int，4.5、3.0 这样带小数部分的数属于 float。类型告诉 Python 这份数据是什么，以及能对它做哪些操作。想查看某个值的类型，可以调用 type。这里先认识类型的名字，不需要先学习“类”的实现。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/values.py",
          "code": "print(7 + 2)\nprint(7 / 2)\nprint(7 // 2)\nprint(7 % 2)\nprint(2 ** 3)\nprint(type(20))\nprint(type(4.5))",
          "purpose": "数字运算和类型显示；每个 print 都对应下面一行结果。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "9\n3.5\n3\n1\n8\n<class 'int'>\n<class 'float'>",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "+、-、* 分别表示加、减、乘；/ 做除法，这里 7 / 2 得到 3.5。// 是向下取整除法，7 // 2 得到 3；% 取余数，7 % 2 得到 1；** 表示乘方，2 ** 3 得到 8。// 不是四舍五入，负数时也按向下取整来理解。"
        },
        {
          "type": "paragraph",
          "text": "type 的输出 <class 'int'> 可以先读成“它是整数”，<class 'float'> 读成“它是浮点数”。浮点数适合很多一般计算，但某些十进制小数不能被它精确表示。先知道这个限制就够了，第一天不必研究二进制表示；如果以后处理金额，需要另选精确规则，不能只靠显示两位小数。"
        }
      ]
    },
    {
      "id": "strings",
      "title": "字符串：文字也有自己的操作",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "字符串 str 用来表示文字，通常用单引号或双引号包住。\"20\" 是文字，20 是数字：看上去相近，能做的事情却不一样。字符串可以包含中文、空格和标点；不要把变量名也加上引号，否则 print(\"name\") 打印的就是 name 这几个字母。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/values.py",
          "code": "message = \"  Python 入门  \"\nprint(message.strip())\nprint(\"Python\" in message)\nprint(len(\"Python\"))\nprint(\"Python\"[0])\nprint(\"Python\"[:2])",
          "purpose": "去空格、判断是否包含文字、取长度和取一部分内容。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "Python 入门\nTrue\n6\nP\nPy",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "message.strip() 得到去掉两端空白后的新字符串，原来的 message 仍然保留那些空格。写在点后面的 strip 是字符串提供的一种操作，这类操作叫方法；你现在先会调用它，第三篇再学习如何给自己的类写方法。"
        },
        {
          "type": "paragraph",
          "text": "len(\"Python\") 得到字符个数 6。[0] 取第一个字符 P，因为下标从 0 开始；[:2] 取前两个字符 Py，右边的 2 不包含在范围中。\"Python\" in message 是在问“里面是否有这段文字”，结果 True 表示有。遇到一个新写法，先把它对应到一个具体问题，比把所有字符串方法一口气记下来更实用。"
        }
      ]
    },
    {
      "id": "boolean-none",
      "title": "布尔值和 None：是否成立，以及有没有值",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "bool 只有 True 和 False 两个值，用来表示判断的结果或某种状态。完成与未完成可以用布尔值保存，而不是分别存成字符串 \"true\"、\"false\"。Python 的拼写是首字母大写；写 true 会被当成一个没有定义的变量名。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/values.py",
          "code": "finished = False\nremark = None\nprint(finished)\nprint(20 >= 30)\nprint(not finished)\nprint(remark is None)",
          "purpose": "比较得到布尔值；None 表示此处还没有具体值。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "False\nFalse\nTrue\nTrue",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "20 >= 30 是一个比较，结果为 False。not finished 把 False 变为 True，可以读成“还没完成”。None 表示没有具体值，例如暂时没有备注；remark is None 专门检查这一点。None、0 和空字符串 \"\" 含义不同，不能因为都可能出现在“空着”的界面上，就把它们混为一种数据。"
        },
        {
          "type": "paragraph",
          "text": "后面还会用到 == 判断值是否相等，!= 判断是否不相等，以及 and、or 组合条件。比如 minutes >= 10 and not finished，要求前后两项都成立。先别担心完整的判断语句，当前只要会看一个表达式最后得到 True 还是 False。"
        }
      ]
    },
    {
      "id": "conversion",
      "title": "需要数字就转换，需要展示就格式化",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/values.py",
          "code": "name = \"小林\"\nminutes = 20\nprint(\"已学 \" + str(minutes) + \" 分钟\")\nprint(f\"{name}已学 {minutes} 分钟\")\nprint(int(\"12\") + 3)",
          "purpose": "把数字放入展示文字，以及把数字形式的字符串转为整数。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "已学 20 分钟\n小林已学 20 分钟\n15",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "str(minutes) 把数字 20 转成可拼接的文字。f 开头的字符串叫 f-string，花括号里写变量，Python 会把它的值放到对应位置。因此最后那种展示方式通常比一连串加号更容易读。"
        },
        {
          "type": "paragraph",
          "text": "int(\"12\") 得到整数 12，随后加 3 得到 15。这不是“只要调用 int 就能得到数字”：int(\"十二\") 会报 ValueError，因为内容不符合这种转换要求。先分清“类型不合适”和“文字内容不能转换”，第四篇会学怎样接住这类错误。"
        }
      ]
    },
    {
      "id": "containers",
      "title": "列表：按顺序放多份数据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "如果要保存三个学习主题，不必起 subjects1、subjects2、subjects3 三个变量。列表 list 可以把多项数据放在一起，用方括号和逗号表示。它保留顺序，允许重复，也允许在后来增加、删除或替换元素。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/collections_demo.py",
          "code": "subjects = [\"Python\", \"函数\"]\nsubjects.append(\"类\")\nprint(subjects)\nprint(subjects[0])\nprint(subjects[-1])\nprint(subjects[:2])\nprint(len(subjects))",
          "purpose": "append 在末尾加入一项；下标和切片仍从0开始。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "['Python', '函数', '类']\nPython\n类\n['Python', '函数']\n3",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "append(\"类\") 在原列表末尾增加元素；[0] 取第一项，[-1] 取最后一项，[:2] 得到前两项组成的新列表。len(subjects) 得到元素个数，而不是把所有文字长度加起来。取不存在的下标会报 IndexError，代码不会自动给你一个空值。"
        }
      ]
    },
    {
      "id": "tuple-set",
      "title": "元组和集合：暂时先学会区分用途",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/collections_demo.py",
          "code": "point = (10, 20)\nprint(point[0])\nlabels = {\"python\", \"web\", \"python\"}\nprint(len(labels))\nprint(\"python\" in labels)",
          "purpose": "元组用来保存固定的一组位置；集合用于不重复的成员。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "10\n2\nTrue",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "tuple 元组常写成 (10, 20)，可以按下标读取，但不能像列表那样替换或追加元素。只有一项的元组要带逗号，例如 (10,)；(10) 只是给数字加括号。不可修改的是元组里的引用位置，不代表它里面若放了列表，那个列表也不能变化。现在可以先用它保存固定的一组值。"
        },
        {
          "type": "paragraph",
          "text": "set 集合让成员不重复，示例里 python 出现两次，最终成员数量仍然是 2。集合没有供你依赖的遍历顺序，不要要求它打印成某个固定排列，也不能用 labels[0] 取第一项。空集合写 set()；{} 是下一节的空字典。"
        }
      ]
    },
    {
      "id": "normalize",
      "title": "字典：用名字说明每个值是什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "一条笔记同时有标题和完成状态。把它写成 [\"学习 Python\", False]，读代码的人必须记住每个位置代表什么；字典 dict 可以给字段命名，例如 title、done。冒号把键和值连起来，逗号分开不同条目。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/collections_demo.py",
          "code": "note = {\"title\": \"学习 Python\", \"done\": False}\nprint(note[\"title\"])\nnote[\"done\"] = True\nprint(note.get(\"tag\", \"未分类\"))\nprint(note)",
          "purpose": "字典通过键取值、修改值，get 可以为缺少的键提供默认值。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "学习 Python\n未分类\n{'title': '学习 Python', 'done': True}",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "note[\"title\"] 取得标题，note[\"done\"] = True 修改完成状态。note.get(\"tag\", \"未分类\") 在没有 tag 这个键时返回默认文字；直接写 note[\"tag\"] 则会报 KeyError。两种写法都能用，选择取决于“这个字段本来就必须有，还是允许没有”。"
        },
        {
          "type": "figure",
          "src": "/figures/python-language-foundations/flow.svg",
          "title": "一个笔记列表里面放了什么",
          "alt": "notes 是列表，其中两项是字典，每个字典包含 title 字符串和 done 布尔值。",
          "caption": "先看外层是多个笔记，再看每条笔记的字段。notes[0][\"title\"] 是先取第一条字典，再从中取标题。 手机端可以在图形区域横向滑动查看。"
        }
      ]
    },
    {
      "id": "copying",
      "title": "先看一个赋值容易踩的坑，再继续写程序",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/collections_demo.py",
          "code": "first = [\"Python\"]\nalias = first\nalias.append(\"函数\")\nprint(first)\nseparate = first.copy()\nseparate.append(\"类\")\nprint(first)\nprint(separate)",
          "purpose": "alias 和 first 访问同一列表；copy 得到新的外层列表。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "['Python', '函数']\n['Python', '函数']\n['Python', '函数', '类']",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "alias = first 没有复制列表，所以通过 alias 追加“函数”后，first 也能看到它。separate = first.copy() 才创建一个新的外层列表，向 separate 追加“类”不会再改变 first。先用实际结果记住“赋值不等于复制”，不用现在就背对象模型的术语。"
        },
        {
          "type": "paragraph",
          "text": "copy 复制的是外层。列表里如果放的是字典，复制后的两份列表仍可能访问同一份内部字典。等以后需要独立修改整棵嵌套数据时，再选择更合适的复制方式；当前例子只有字符串，足够看清这一次差别。"
        }
      ]
    },
    {
      "id": "conditions",
      "title": "if：根据条件决定做什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在已经能表达“时长是不是大于30”，可以用 if 根据这个结果选择代码。if 后面写条件，行尾加冒号；属于它的代码向右缩进，通常使用四个空格。elif 表示前面不成立时再判断，else 表示前面的条件都没有成立。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/control_flow.py",
          "code": "minutes = 20\nif minutes >= 30:\n    print(\"今天已经完成计划\")\nelif minutes > 0:\n    print(\"已经开始，继续加油\")\nelse:\n    print(\"从五分钟开始\")",
          "purpose": "将 minutes 改成0、20、30再运行，分别进入不同分支。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "已经开始，继续加油",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "minutes 是 20，第一个条件不成立，第二个 minutes > 0 成立，所以只打印第二段。这个 if / elif / else 结构选择其中一条路径，不会因为20也小于30，就自动把所有分支都跑一遍。缩进是语法，不只是排版；同一层代码必须对齐。"
        }
      ]
    },
    {
      "id": "loops",
      "title": "for 和 while：把重复动作交给程序",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/control_flow.py",
          "code": "notes = [\n    {\"title\": \"学习 Python\", \"done\": False},\n    {\"title\": \"复习变量\", \"done\": True},\n]\nfor note in notes:\n    if not note[\"done\"]:\n        print(\"待完成：\" + note[\"title\"])",
          "purpose": "for 每次取出一条笔记；只有未完成的才打印。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "待完成：学习 Python",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "notes 是包含两个字典的列表，for note in notes 让 note 依次代表每一项。第一条的 done 是 False，not False 得到 True，于是显示它的标题；第二条已经完成，不进入内层 print。循环结束不代表笔记被删除，只是打印时跳过了已完成项。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/control_flow.py",
          "code": "for number in range(1, 4):\n    print(number)\nremaining = 2\nwhile remaining > 0:\n    print(\"还剩\", remaining)\n    remaining = remaining - 1",
          "purpose": "range 生成需要的数字，while 则重复检查条件。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "1\n2\n3\n还剩 2\n还剩 1",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "range(1, 4) 提供 1、2、3，不包含右端点4。while remaining > 0 则每次先检查还剩多少，本例在循环内减1，所以最终会停；如果忘了更新条件依赖的值，就可能一直重复。知道具体要遍历哪组数据时，优先使用 for，通常更容易看出程序在做什么。"
        }
      ]
    },
    {
      "id": "cli",
      "title": "怎样运行配套文件，不把多个目录弄混",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/python-course/beginner\npython3 values.py\npython3 collections_demo.py\npython3 control_flow.py",
          "language": "bash",
          "purpose": "在仓库中使用这组路径。若下载 python-course.zip，解压后进入 python-course/beginner，随后执行同样的三个 python3 命令。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "三个文件把本篇的小例子按顺序放在一起，因此整文件运行会显示多组输出；正文每个代码块只对照当前小例子。你也可以每次新建一个 demo.py，只复制当前一组代码，这种练法更容易知道某一行的结果来自哪里。"
        },
        {
          "type": "paragraph",
          "text": "终端说“找不到文件”时，先看当前目录和文件名；说“找不到python3”时，先检查解释器安装；出现 Traceback 时，先看最后一行的错误类型，再根据文件名和行号回到代码。不要一看到英文就把整段程序重写。"
        }
      ]
    },
    {
      "id": "run",
      "title": "练习：先想结果，再自己改一行",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "练习一：把 minutes 改成30，判断例子会打印什么？答案是“今天已经完成计划”，因为第一项 >= 比较已经成立。把 >= 写成 > 后，恰好30就不会进入第一分支，这能帮助你区分“大于”和“大于等于”。"
        },
        {
          "type": "paragraph",
          "text": "练习二：在 notes 中加一条 {\"title\":\"练习列表\",\"done\":False}，会多打印什么？答案是“待完成：练习列表”。新增的是一个字典条目，它和其他条目一样经过循环与 done 检查，不必再为第三条复制一份 if。"
        },
        {
          "type": "paragraph",
          "text": "练习三：希望给每条笔记补上默认分类，可以在循环里写 note[\"tag\"] = \"学习\"。这会修改列表中的字典，而不是只修改一个暂时无关的副本。先打印修改后的 notes，确认你确实理解了列表、字典和赋值三者的关系。"
        }
      ]
    },
    {
      "id": "boundaries",
      "title": "这一篇学到哪里，下一篇为什么需要函数",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "遇到 \"3\" + 2 的 TypeError，先决定是在做计算还是展示：计算可写 int(\"3\") + 2，展示可写 \"3\" + str(2)。遇到列表下标越界，检查列表长度和从0开始的下标；遇到字典 KeyError，检查键名和字段是否允许缺失。错误给出的不是一道抽象分类题，而是这行操作与数据不匹配的线索。"
        },
        {
          "type": "paragraph",
          "text": "现在你已经能保存数据、选择分支、重复处理。下一步如果三个地方都需要“清理标题、创建一条笔记”，一直复制同样的代码会难以修改。函数正是把一段有明确用途的操作命名，并在需要时调用。第二篇从这里继续，不会突然把你丢进文件导入管道。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "Python3.12：第一段程序、数字和字符串",
      "url": "https://docs.python.org/3.12/tutorial/introduction.html"
    },
    {
      "title": "Python3.12：列表、字典与集合",
      "url": "https://docs.python.org/3.12/tutorial/datastructures.html"
    },
    {
      "title": "Python3.12：判断和循环",
      "url": "https://docs.python.org/3.12/tutorial/controlflow.html"
    }
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "CPython 3.12.14"
  ],
  "verifiedAt": "2026-10-26",
  "labMinutes": 30,
  "examples": [
    {
      "label": "Python 课程与新入门示例 ZIP",
      "path": "python-course.zip"
    },
    {
      "label": "从这里开始：九篇顺序、文件与命令",
      "path": "python-course/beginner/README.md"
    }
  ]
};
export default article;
