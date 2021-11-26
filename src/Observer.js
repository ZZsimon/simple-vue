
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

