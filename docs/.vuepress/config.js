const path = require("path");
module.exports = {
  base: "/Learn-Vue-Source-Code/",
  dest: "dist",
  title: "Vue.js 源码学习",
  serviceWorker: false,
  markdown: {
    lineNumbers: true
  },
  configureWebpack: {
    resolve: {
      alias: {
        '@': path.join(__dirname, 'public','assets')
      }
    }
  },
  head: [
    ['link', { rel: 'icon', href: `/logo.png` }],
    ['link', { rel: 'manifest', href: '/manifest.json' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
    ['link', { rel: 'apple-touch-icon', href: `/icons/apple-touch-icon-152x152.png` }],
    ['link', { rel: 'mask-icon', href: '/icons/safari-pinned-tab.svg', color: '#3eaf7c' }],
    ['meta', { name: 'msapplication-TileImage', content: '/icons/msapplication-icon-144x144.png' }],
    ['meta', { name: 'msapplication-TileColor', content: '#000000' }]
  ],
  themeConfig: {
    repo: "NLRX-WJC/Learn-Vue-Source-Code",
    editLinks: true,
    docsDir: "docs",
	editLinkText: '在 GitHub 上编辑此页',
	lastUpdated: '上次更新',
    nav: [
      // {
      //   text: '2.x 版本',
      //   link: '/v2/prepare/'
      // },
      // {
      //   text: '3.x 版本',
      //   link: '/v3/guide/'
      // },
      // {
      //   text: '配套视频',
      //   link: 'https://coding.imooc.com/class/228.html'
      // }
    ],
    sidebarDepth : 1,
    sidebar: [
      {
        title: "写在最前面",
        collapsable: false,
        children: [
          ["start/",'写在最前面']
        ]
      },
      {
        title: "变化侦测",
        collapsable: false,
        children: [
          ["reactive/",'综述'],
          ["reactive/object",'Object的变化侦测'],
          ["reactive/array",'Array的变化侦测'],
        ]
      }
    ]
  }
};
