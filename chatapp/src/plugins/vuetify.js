import "vuetify/styles"
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from "vuetify"
import * as components from "vuetify/components"
import * as directives from "vuetify/directives"

const customTheme = {
  colors: {
    primary: "#3498db",
  }
}

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: "customTheme",
    themes: { customTheme }
  },
  icons: {
    defaultSet: 'mdi', //iconを使用するため
  },
})