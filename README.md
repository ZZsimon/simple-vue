# simple-vue


### 如何实现双向绑定？
1. 首先需要能正确渲染，那么得实现一个编译器Compiler，将Vue语法编译成html代码
    1. 将 \<div v-model={{word}}>{{ text }}\</div\> 中的text替换成对应数据，解析字符串的时候可以解析出 text 名称，然后在传入的数据中寻找key值为text的value是什么
    2. v-model替换成事件监听
    3. 渲染这个节点
    
2. 其次能监听数据变化的观察者（Observer）

3. 当数据变化的时候，可以触发渲染。（就是需要一个可以让Compiler和Observer进行通信的桥梁）

    #### 以上是单向绑定

4. 通过监听浏览器事件，更改数据，然后触发上面的流程，就实现了双向绑定。（其实就是v-model的实现）

### new Vue()构造函数中做了哪些事情？
```js
// 伪代码
function Vue(options) {
    // 给实例添加属性
    this.$options=options

    // 利用Object.defineProperty监听数据
    observe(options.data);

    // 传入最外层根节点，编译它的所有子元素，将Vue语法转换成html代码，然后插入根节点，渲染出来。
    this.$compile = new Compile(options.el || document.body, this)
}
```

### Observe实现
```js

// 这就是一个订阅-发布模式中的消息中心
class Dep {
    subs = new Set();
    addSub(sub){
        this.subs.add(sub);
    }
    removeSub (sub) { // 删除订阅者
        this.subs.delete(sub);
    }
    notify() {
        console.log(this.subs, 'this.subs')
        for (let sub of this.subs) {
            sub.update();
        }
    }
}

function Observe(data) {
    if (!data || typeof data !== 'object') {
        return;
    }
    console.log(data, 'data')
    // 取出所有属性遍历
    Object.keys(data).forEach(function(key) {
	    defineReactive(data, key, data[key]);
	});
};

function defineReactive(data, key, val) {
    const dep = new Dep(); // 为每个key创建一个存放关心该key的订阅者的容器

    var childObj = Observe(val); // 监听子属性
    Object.defineProperty(data, key, {
        enumerable: true,
        configurable: false,
        get: function() {
            Dep.target && dep.addSub(Dep.target);
            return val;
        },
        set: function(newVal) {
            console.log('监听到新的值是：',newVal);
            console.log(data, 'data')
            val = newVal;
            childObj = Observe(newVal);
            dep.notify(); // key变化的时候，利用dep这个消息中心实例，通知所有订阅者
        }
    });
}



```
### Compile实现
1. 根据不同的节点类型和指令，来解析（用不同的原生DOM API来修改，如修改class、textContent、innerHTML等）
2. 调用「Watcher」函数 

#### 双向绑定中的1，2都实现了，Watcher就是用来实现3的

```js
// 伪代码
class  Compile(el, vm) {
    constructor(el, vm){
        this.$vm = vm;
        this.$el = document.querySelector(el);
         if (this.$el) {
            this.$fragment = this.node2Fragment(this.$el);
            // 对代码片段做处理
            this.init();
            // 然后插入根节点
            this.$el.appendChild(this.$fragment);
        }
    }

     node2Fragment(el) {
        var fragment = document.createDocumentFragment(),
            child;

        // 将原生节点拷贝到fragment
        while (child = el.firstChild) {
            fragment.appendChild(child);
        }

        return fragment;
    }

    init() {
        this.compileElement(this.$fragment);
    },

    compileElement(el) {
        var childNodes = el.childNodes,
            me = this;

        // 
        [].slice.call(childNodes).forEach(function(node) {
            var text = node.textContent;
            var reg = /\{\{(.*)\}\}/;
            
            // 根据不同的节点类型和指令，来解析
            // 最终都会做的事情是：都会调用new Watcher( ... )
            if (me.isElementNode(node)) {
                me.compile(node);

            } else if (me.isTextNode(node) && reg.test(text)) {
                me.compileText(node);
            }

            if (node.childNodes && node.childNodes.length) {
                me.compileElement(node);
            }
        });
    },
    
   
}

```



### Watcher实现
```js
// 伪代码
function Watcher(vm, expOrFn, cb) {
    this.cb = cb;
    this.vm = vm;
    this.expOrFn = expOrFn;
    this.depIds = {};

    // this.getter方法的作用是为了触发 属性的getter
    if (typeof expOrFn === 'function') {
        this.getter = expOrFn;
    } else {
        this.getter = this.parseGetter(expOrFn.trim());
    }
    // 触发属性的getter，从而在dep添加实例
    this.value = this.get();
}

Watcher.prototype = {
    constructor: Watcher,
    update: function() {
        // Watcher实例会存放于 某个数据的消息中心的subs中
        // 当数据发生变化的就会触发 update
        this.run();
    },
    run: function() {
        var value = this.get();
        var oldVal = this.value;
        if (value !== oldVal) {
            this.value = value;
            // 拿到新数据后，执行回调函数，去真正的更改DOM
            this.cb.call(this.vm, value, oldVal);
        }
    },
    addDep: function(dep) {
        if (!this.depIds.hasOwnProperty(dep.id)) {
            dep.addSub(this);
            this.depIds[dep.id] = dep;
        }
    },
    get: function() {
        // Dep.target = this 标记订阅者是当前watcher实例
        Dep.target = this;
        // 由于接下来的语句会触发 数据的get函数
        // 因此可以通过这个操作来添加订阅者，这个订阅者其实就是当前这个「Watcher」实例
        var value = this.getter.call(this.vm, this.vm);
        // 当添加订阅者完毕后，就清空当前的 Dep.target
        Dep.target = null;
        return value;
    },

    parseGetter: function(exp) {
        if (/[^\w.$]/.test(exp)) return; 

        var exps = exp.split('.');

        return function(obj) {
            for (var i = 0, len = exps.length; i < len; i++) {
                if (!obj) return;
                obj = obj[exps[i]];
            }
            return obj;
        }
    }
};
```

### 实现简单Vue
```js
function SimpleVue(options) {
    this.$options = options;
    var data = this._data = this.$options.data, me = this;
    // 属性代理，实现 vm.xxx -> vm._data.xxx
    Object.keys(data).forEach(function(key) {
        me._proxy(key);
    });
    Observe(data, this);
    this.$compile = new Compile(options.el || document.body, this)
}

SimpleVue.prototype = {
	_proxy: function(key) {
		var me = this;
        Object.defineProperty(me, key, {
            configurable: false,
            enumerable: true,
            get: function proxyGetter() {
                return me._data[key];
            },
            set: function proxySetter(newVal) {
                me._data[key] = newVal;
            }
        });
	}
};

```

### 使用简单Vue
```Vue
<div id="vue-app">
    <input type="text" v-model="name">
    <input type="text" v-model="age">
    <h1>{{ dependNameValue }}</h1>
    <button v-on:click="clickBtn">手动改变age变成13</button>
</div>

var vm = new SimpleVue({
    el: '#vue-app',
    data: {
        name: 'simon',
        age: '12',
    },

    computed: {
        dependNameValue: function () {
            return this.name + '依赖name的值';
        }
    },

    methods: {
        clickBtn: function (e) {
            this.age = '13'
        }
    }
});

```