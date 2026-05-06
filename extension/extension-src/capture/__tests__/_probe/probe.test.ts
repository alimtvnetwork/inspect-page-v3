import { describe, it } from "vitest";
import { inlineIframes } from "../../extension-src/capture/inlineIframes";
import { serializeWithShadow } from "../../extension-src/capture/shadowSerializer";
describe("p", () => {
  it("p", async () => {
    const f1 = document.createElement("iframe"); f1.setAttribute("src","https://example.com/a"); document.body.appendChild(f1);
    const f2 = document.createElement("iframe"); f2.setAttribute("src","https://other.com/b"); document.body.appendChild(f2);
    const f3 = document.createElement("iframe"); f3.setAttribute("src","https://example.com/c"); document.body.appendChild(f3);
    const sd = (html: string) => new DOMParser().parseFromString(html,"text/html");
    Object.defineProperty(f1,"contentDocument",{get:()=>sd("<html><body><p>a</p></body></html>")});
    Object.defineProperty(f2,"contentDocument",{get:()=>{throw new Error("X")}});
    Object.defineProperty(f3,"contentDocument",{get:()=>sd("<html><body><p>c</p></body></html>")});
    const html = `<!DOCTYPE html>${serializeWithShadow(document.documentElement)}`;
    console.log("BEFORE:", html);
    const r = await inlineIframes(html, document);
    console.log("AFTER:", r.html);
    console.log("COUNTS:", JSON.stringify(r.counts));
  });
});
