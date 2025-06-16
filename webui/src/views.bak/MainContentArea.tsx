import { Breadcrumb, Layout, Spin, theme } from "antd";
import { Content } from "antd/es/layout/layout";
import React from "react";

// 面包屑导航项接口
interface BreadcrumbItem {
  title: string;
  onClick?: () => void;
}

// 主内容区域模板组件
export const MainContentAreaTemplate = ({
  breadcrumbs,
  children,
}: {
  breadcrumbs: BreadcrumbItem[];
  children: React.ReactNode;
}) => {
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  return (
    <Layout style={{ padding: "0 24px 24px" }}>
      {/* 面包屑导航 */}
      <Breadcrumb
        style={{ margin: "16px 0" }}
        items={[...(breadcrumbs || [])]}
      />
      {/* 主内容区域 */}
      <Content
        style={{
          padding: 24,
          margin: 0,
          minHeight: 280,
          background: colorBgContainer,
        }}
      >
        {children}
      </Content>
    </Layout>
  );
};