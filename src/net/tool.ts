// ... existing code ...
/**
 * 获取设备唯一ID（如无则自动生成并持久化到 localStorage）
 */
export function getDeviceId(): string {
    const key = 'device_unique_id';
    let id = localStorage.getItem(key);
    if (!id) {
        id = generateUUID();
        localStorage.setItem(key, id);
    }

    return id;
}


/**
 * 生成一个简单的 UUID v4
 */
function generateUUID(): string {
    // 兼容性好且足够随机
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 设置 cookie
 * @param name cookie 名称
 * @param value cookie 值
 * @param days 有效天数，默认 365 天
 */
export function setCookie(name: string, value: string, days = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}
