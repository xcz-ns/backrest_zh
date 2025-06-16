import { Breadcrumb, Layout, Spin, theme } from "antd";
import { Content } from "antd/es/layout/layout";
import React from "react";

interface 面包屑导航 {
  标题: string;
  点击事件?: () => void;
}

export const 主内容区域模板 = ({
  面包屑路径,
  子元素,
}: {
  面包屑路径: 面包屑导航[];
  子元素: React.ReactNode;
}) => {
  const {
    token: { 颜色背景容器 },
  } = theme.useToken();

  return (
    <布局 style={{ padding: "0 24px 24px" }}>
      <面包屑导航
        style={{ margin: "16px 0" }}
        items={[...(面包屑路径 || [])]}
      ></面包屑导航>
      <内容区域
        style={{
          padding: 24,
          margin: 0,
          minHeight: 280,
          background: 颜色背景容器,
        }}
      >
        {子元素}
      </内容区域>
    </布局>
  );
};