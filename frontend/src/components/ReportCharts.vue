<template>
  <div class="report-chart" :style="{ height: height + 'px' }">
    <h4 v-if="title" class="chart-title">{{ title }}</h4>
    <v-chart :option="chartOption" autoresize />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent
} from 'echarts/components'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent
])

const props = withDefaults(defineProps<{
  type: 'line' | 'bar' | 'pie' | 'ring' | 'horizontal-bar'
  data: any[]
  title?: string
  height?: number
  xField?: string
  yField?: string
  nameField?: string
  valueField?: string
}>(), {
  height: 240,
  xField: 'name',
  yField: 'value',
  nameField: 'name',
  valueField: 'value'
})

const COLORS = ['#533afd', '#0cce6b', '#f5a623', '#e25950', '#6366f1', '#14b8a6', '#f97316', '#8b5cf6']

const chartOption = computed(() => {
  if (props.type === 'pie' || props.type === 'ring') {
    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 12, color: '#666' }
      },
      color: COLORS,
      series: [{
        type: 'pie',
        radius: props.type === 'ring' ? ['40%', '70%'] : ['0%', '70%'],
        center: ['50%', '45%'],
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' }
        },
        data: props.data.map((item: any) => ({
          name: item[props.nameField],
          value: item[props.valueField]
        }))
      }]
    }
  }

  if (props.type === 'horizontal-bar') {
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 120, right: 20, top: 10, bottom: 30 },
      xAxis: { type: 'value', axisLabel: { fontSize: 11 } },
      yAxis: {
        type: 'category',
        data: [...props.data].reverse().map((item: any) => item[props.xField]),
        axisLabel: { fontSize: 12, width: 100, overflow: 'truncate' }
      },
      color: COLORS,
      series: [{
        type: 'bar',
        data: [...props.data].reverse().map((item: any) => item[props.yField || 'amount']),
        barWidth: 16,
        itemStyle: { borderRadius: [0, 4, 4, 0] }
      }]
    }
  }

  // line or bar (vertical)
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'category',
      data: props.data.map((item: any) => item[props.xField]),
      axisLabel: { fontSize: 11, rotate: props.data.length > 6 ? 30 : 0 }
    },
    yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    color: COLORS,
    series: props.type === 'line' ? [{
      type: 'line',
      data: props.data.map((item: any) => item[props.yField]),
      smooth: true,
      areaStyle: { opacity: 0.08 },
      itemStyle: { borderRadius: 4 },
      symbolSize: 6
    }] : [{
      type: 'bar',
      data: props.data.map((item: any) => item[props.yField]),
      barWidth: 20,
      itemStyle: { borderRadius: [4, 4, 0, 0] }
    }]
  }
})
</script>

<style scoped>
.report-chart {
  display: flex;
  flex-direction: column;
}
.chart-title {
  margin: 0 0 8px;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-600);
  color: var(--color-text-primary);
}
</style>
