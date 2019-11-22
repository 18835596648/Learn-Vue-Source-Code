/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'

// Regular Expressions for parsing tags and attributes
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// could use https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName
// but for Vue templates we can enforce a simple charset
/**
 * 匹配开始标签的正则
 * 以开始标签开始的模板：
 * '<div></div>'.match(startTagOpen)  => ['<div','div',index:0,input:'<div></div>']
 * 以结束标签开始的模板：
 * '</div><div></div>'.match(startTagOpen) => null
 * 以文本开始的模板：
 * '我是文本</p>'.match(startTagOpen) => null
 */
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)


const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being pased as HTML comment when inlined in page
const comment = /^<!\--/
const conditionalComment = /^<!\[/

let IS_REGEX_CAPTURING_BROKEN = false
'x'.replace(/x(.)?/g, function (m, g) {
  IS_REGEX_CAPTURING_BROKEN = g === ''
})

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t'
}
const encodedAttr = /&(?:lt|gt|quot|amp);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML (html, options) {
  const stack = []   // 维护AST节点层级的栈
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no  //用来检测一个标签是否是可以省略闭合标签的非自闭合标签
  let index = 0
  let last,  //解析游标，标识当前从何处开始解析模板字符串
  lastTag  // 存储着位于 stack 栈顶的元素
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    // 父元素为正常元素的处理逻辑
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      /**
       * 如果html字符串是以'<'开头,则有以下几种可能
       * 开始标签:<div>
       * 结束标签:</div>
       * 注释:<!-- 我是注释 -->
       * 条件注释:<!-- [if !IE] --> <!-- [endif] -->
       * DOCTYPE:<!DOCTYPE html>
       * 需要一一去匹配尝试
       */
      if (textEnd === 0) {
        // Comment:
        // 解析是否是注释
        if (comment.test(html)) {
          // 若为注释，则继续查找是否存在'-->'
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            // 若存在 '-->',继续判断options中是否保留注释
            if (options.shouldKeepComment) {
              // 若保留注释，则把注释截取出来赋给options.comment，创建注释类型的AST节点
              options.comment(html.substring(4, commentEnd))
            }
            // 若不保留注释，则将游标移动到'-->'之后，继续向后解析
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // 解析是否是条件注释
        if (conditionalComment.test(html)) {
          // 若为条件注释，则继续查找是否存在']>'
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            // 若存在 ']>',则从原本的html字符串中把条件注释截掉，把剩下的内容重新赋给html，继续向后匹配
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        // 解析是否是DOCTYPE
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        // 匹配是否是结束标签
        const endTagMatch = html.match(endTag)
        /**
         * '</div>'.match(endTag) => ["</div>", "div", index: 0, input: "</div>", groups: undefined]
         */
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        // 匹配是否是开始标签
        const startTagMatch = parseStartTag()
        
        if (startTagMatch) {
          /**
          * 如果是开始标签，则可拿到下面这些数据
          * const startTagMatch = {
          *   tagName: '',
          *   attrs: [],
          *   start: index,
          *   unarySlash:''
          * }
         */
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(lastTag, html)) {
            advance(1)
          }
          continue
        }
      }

      // 如果html字符串不是以'<'开头
      let text, rest, next
      if (textEnd >= 0) {
        // 如果html字符串不是以'<'开头,说明'<'前面的都是纯文本，无需处理
        // 那就把'<'以后的内容拿出来赋给rest
        rest = html.slice(textEnd)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          /**
           * 用'<'以后的内容rest去匹配endTag、startTagOpen、comment、conditionalComment
           * 如果都匹配不上，表示'<'是属于文本本身的内容
           */
          // 在'<'之后查找是否还有'<'
          next = rest.indexOf('<', 1)
          // 如果没有了，表示'<'后面也是文本
          if (next < 0) break
          // 如果还有，表示'<'是文本中的一个字符
          textEnd += next
          // 那就把next之后的内容截出来继续下一轮循环匹配
          rest = html.slice(textEnd)
        }
        // 最后截取出文本
        text = html.substring(0, textEnd)
        advance(textEnd)
      }

      // 如果在html字符串中没有找到'<'，表示这一段html字符串都是纯文本
      if (textEnd < 0) {
        text = html
        html = ''
      }

      // 把截取出来的text转化成textAST
      if (options.chars && text) {
        options.chars(text)
      }
    } else {
      // 父元素为script、style、textarea时，其内部的内容全部当做纯文本处理
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    /**
     * 如果经过上述所有处理逻辑处理过后，html字符串没有任何变化，
     * 即表示html字符串没有匹配上任何一条规则
     * 那么就认为html字符串中的标签格式有误，抛出异常
     */ 
    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      break
    }
  }

  // Clean up any remaining tags
  // 如果执行到这里，表示在html字符串中的标签格式有误那里break出了循环，那么就清理掉所有剩余标签
  parseEndTag()

  function advance (n) {
    index += n
    html = html.substring(n)
  }

  function parseStartTag () {
    const start = html.match(startTagOpen)
    // '<div></div>'.match(startTagOpen)  => ['<div','div',index:0,input:'<div></div>']
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      /**
       * <div a=1 b=2 c=3></div>
       * 从<div之后到开始标签的结束符号'>'之前，一直匹配属性attrs
       * 所有属性匹配完之后，html字符串还剩下 
       * 自闭合标签剩下：'/>'
       * 非自闭合标签剩下：'></div>'
       */
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        advance(attr[0].length)
        match.attrs.push(attr)
      }

      /**
       * 这里判断了该标签是否为自闭合标签
       * 自闭合标签如:<input type='text' />
       * 非自闭合标签如:<div></div>
       * '></div>'.match(startTagClose) => [">", "", index: 0, input: "></div>", groups: undefined]
       * '/><div></div>'.match(startTagClose) => ["/>", "/", index: 0, input: "/><div></div>", groups: undefined]
       * 因此，我们可以通过end[1]是否是"/"来判断该标签是否是自闭合标签
       */
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  function handleStartTag (match) {
    const tagName = match.tagName    // 开始标签的标签名
    const unarySlash = match.unarySlash   // 是否为自闭合标签的标志，自闭合为"",非自闭合为"/"

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    const unary = isUnaryTag(tagName) || !!unarySlash   // 布尔值，标志是否为自闭合标签

    const l = match.attrs.length   // match.attrs 数组的长度
    const attrs = new Array(l)       // 一个与match.attrs数组长度相等的数组
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      // hackish work around FF bug https://bugzilla.mozilla.org/show_bug.cgi?id=369778
      if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
        if (args[3] === '') { delete args[3] }
        if (args[4] === '') { delete args[4] }
        if (args[5] === '') { delete args[5] }
      }
      const value = args[3] || args[4] || args[5] || ''
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
    }

    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      lastTag = tagName
    }

    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
    }

    // Find the closest opened tag of the same type
    if (tagName) {
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
