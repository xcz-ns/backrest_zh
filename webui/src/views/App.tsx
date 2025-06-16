import React, { Suspense, useEffect, useState } from "react";
import {
  ScheduleOutlined,
  DatabaseOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ExclamationOutlined,
  SettingOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Button, Empty, Layout, Menu, Spin, theme } from "antd";
import { Config } from "../../gen/ts/v1/config_pb";
import { useAlertApi } from "../components/Alerts";
import { useShowModal } from "../components/ModalManager";
import { uiBuildVersion } from "../state/buildcfg";
import { ActivityBar } from "../components/ActivityBar";
import { OperationEvent, OperationStatus } from "../../gen/ts/v1/operations_pb";
import {
  subscribeToOperations,
  unsubscribeFromOperations,
} from "../state/oplog";
import LogoSvg from "url:../../assets/logo.svg";
import _ from "lodash";
import { Code } from "@connectrpc/connect";
import { 登录模态框 } from "./LoginModal";
import { backrestService, setAuthToken } from "../api";
import { useConfig } from "../components/ConfigProvider";
import { shouldShowSettings } from "../state/configutil";
import { OpSelector, OpSelectorSchema } from "../../gen/ts/v1/service_pb";
import { colorForStatus } from "../state/flowdisplayaggregator";
import { getStatusForSelector, matchSelector } from "../state/logstate";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import { 主内容区域模板 } from "./MainContentArea";
import { create } from "@bufbuild/protobuf";

const { Header, Sider } = Layout;

// 懒加载组件
const SummaryDashboard = React.lazy(() =>
  import("./SummaryDashboard").then((m) => ({
    default: m.SummaryDashboard,
  }))
);
const GettingStartedGuide = React.lazy(() =>
  import("./GettingStartedGuide").then((m) => ({
    default: m.GettingStartedGuide,
  }))
);
const PlanView = React.lazy(() =>
  import("./PlanView").then((m) => ({
    default: m.PlanView,
  }))
);
const RepoView = React.lazy(() =>
  import("./RepoView").then((m) => ({
    default: m.RepoView,
  }))
);

// 仓库视图容器
const RepoViewContainer = () => {
  const { repoId } = useParams();
  const [config, setConfig] = useConfig();
  
  if (!config) {
    return <Spin />;
  }
  
  const repo = config.repos.find((r) => r.id === repoId);
  return (
    <主内容区域模板
      breadcrumbs={[{ title: "仓库" }, { title: repoId! }]}
      key={repoId}
    >
      {repo ? (
        <仓库视图 repo={repo} />
      ) : (
        <Empty description={`仓库 ${repoId} 未找到`} />
      )}
    </主内容区域模板>
  );
};

// 计划视图容器
const 计划视图容器 = () => {
  const { planId } = useParams();
  const [config, setConfig] = useConfig();
  
  if (!config) {
    return <Spin />;
  }
  
  const plan = config.plans.find((p) => p.id === planId);
  return (
    <主内容区域模板
      breadcrumbs={[{ title: "计划" }, { title: planId! }]}
      key={planId}
    >
      {plan ? (
        <计划视图 plan={plan} />
      ) : (
        <Empty description={`计划 ${planId} 未找到`} />
      )}
    </主内容区域模板>
  );
};

export const 应用: React.FC = () => {
  const {
    token: { colorBgContainer, colorTextLightSolid },
  } = theme.useToken();
  
  const navigate = useNavigate();
  const [config, setConfig] = useConfig();
  const items = 获取侧边导航菜单项(config);
  
  return (
    <Layout style={{ height: "auto", minHeight: "100vh" }}>
      {/* 顶部导航栏 */}
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          height: "60px",
          backgroundColor: "#1b232c",
        }}
      >
        {/* LOGO 和标题 */}
        <a
          style={{ color: colorTextLightSolid }}
          onClick={() => {
            navigate("/");
          }}
        >
          <img
            src={LogoSvg}
            style={{
              height: "30px",
              color: "white",
              marginBottom: "-8px",
              paddingRight: "10px",
            }}
          />
        </a>
        
        <h1>
          {/* 版本号链接 */}
          <a href="https://github.com/garethgeorge/backrest"  target="_blank">
            <small
              style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6em" }}
            >
              {uiBuildVersion}
            </small>
          </a>
          
          {/* 活动状态条 */}
          <small style={{ fontSize: "0.6em", marginLeft: "30px" }}>
            <ActivityBar />
          </small>
        </h1>
        
        {/* 右侧状态信息 */}
        <h1 style={{ position: "absolute", right: "20px" }}>
          <small style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6em" }}>
            {config && config.instance ? config.instance : undefined}
          </small>
          
          {/* 登出按钮 */}
          <Button
            type="text"
            style={{
              marginLeft: "10px",
              color: "white",
              visibility: config?.auth?.disabled ? "hidden" : "visible",
            }}
            onClick={() => {
              setAuthToken("");
              window.location.reload();
            }}
          >
            登出
          </Button>
        </h1>
      </Header>
      
      {/* 主体布局 */}
      <Layout>
        {/* 侧边栏 */}
        <Sider width={300} style={{ background: colorBgContainer }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={["1"]}
            defaultOpenKeys={["plans", "repos"]}
            style={{ height: "100%", borderRight: 0 }}
            items={items}
          />
        </Sider>
        
        {/* 路由容器 */}
        <认证边界>
          <Suspense fallback={<Spin />}>
            <Routes>
              {/* 主页 */}
              <Route
                path="/"
                element={
                  <主内容区域模板 breadcrumbs={[{ title: "概览" }]}>
                    <汇总仪表板 />
                  </主内容区域模板>
                }
              />
              
              {/* 入门指南 */}
              <Route
                path="/getting-started"
                element={
                  <主内容区域模板
                    breadcrumbs={[{ title: "入门指南" }]}
                  >
                    <入门指南 />
                  </主内容区域模板>
                }
              />
              
              {/* 计划详情 */}
              <Route path="/plan/:planId" element={<计划视图容器 />} />
              
              {/* 仓库详情 */}
              <Route path="/repo/:repoId" element={<仓库视图容器 />} />
              
              {/* 404页面 */}
              <Route
                path="/*"
                element={
                  <主内容区域模板 breadcrumbs={[]}>
                    <Empty description="页面未找到" />
                  </主内容区域模板>
                }
              />
            </Routes>
          </Suspense>
        </认证边界>
      </Layout>
    </Layout>
  );
};

// 认证边界组件
const 认证边界 = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [config, setConfig] = useConfig();
  const alertApi = useAlertApi()!;
  const showModal = useShowModal();
  
  useEffect(() => {
    backrestService
      .getConfig({})
      .then((config) => {
        setConfig(config);
        
        if (shouldShowSettings(config)) {
          import("./SettingsModal").then(({ SettingsModal }) => {
            showModal(<SettingsModal />);
          });
        } else {
          showModal(null);
        }
      })
      .catch((err) => {
        const code = err.code;
        
        if (err.code === Code.Unauthenticated) {
          showModal(<登录模态框 />);
          return;
        } else if (
          err.code !== Code.Unavailable &&
          err.code !== Code.DeadlineExceeded
        ) {
          alertApi.error(err.message, 0);
          return;
        }
        
        alertApi.error(
          "获取初始配置失败，通常这意味着UI无法连接到后端服务",
          0
        );
      });
  }, []);
  
  if (!config) {
    return <></>;
  }
  
  return <>{children}</>;
};

// 生成侧边栏菜单项
const 获取侧边导航菜单项 = (config: Config | null): MenuProps["items"] => {
  const showModal = useShowModal();
  const navigate = useNavigate();
  
  if (!config) {
    return;
  }
  
  const reposById = _.keyBy(config.repos, (r) => r.id);
  const configPlans = config.plans || [];
  const configRepos = config.repos || [];
  
  // 计划菜单项
  const plans: MenuProps["items"] = [
    {
      key: "add-plan",
      icon: <PlusOutlined />,
      label: "新建计划",
      onClick: async () => {
        const { AddPlanModal } = await import("./AddPlanModal");
        showModal(<AddPlanModal template={null} />);
      },
    },
    ...configPlans.map((plan) => {
      const sel = create(OpSelectorSchema, {
        instanceId: config.instance,
        planId: plan.id,
        repoGuid: reposById[plan.repo]?.guid,
      });
      
      return {
        key: "p-" + plan.id,
        icon: <图标ForResource selector={sel} />,
        label: (
          <div
            className="backrest visible-on-hover"
            style={{ width: "100%", height: "100%" }}
          >
            {plan.id} 
            <Button
              className="hidden-child float-center-right"
              type="text"
              size="small"
              shape="circle"
              style={{ width: "30px", height: "30px" }}
              icon={<SettingOutlined />}
              onClick={async () => {
                const { AddPlanModal } = await import("./AddPlanModal");
                showModal(<AddPlanModal template={plan} />);
              }}
            />
          </div>
        ),
        onClick: async () => {
          navigate(`/plan/${plan.id}`);
        },
      };
    }),
  ];
  
  // 仓库菜单项
  const repos: MenuProps["items"] = [
    {
      key: "add-repo",
      icon: <PlusOutlined />,
      label: "新建仓库",
      onClick: async () => {
        const { AddRepoModal } = await import("./AddRepoModal");
        showModal(<AddRepoModal template={null} />);
      },
    },
    ...configRepos.map((repo) => {
      return {
        key: "r-" + repo.id,
        icon: (
          <图标ForResource
            selector={create(OpSelectorSchema, {
              instanceId: config.instance,
              repoGuid: repo.guid,
            })}
          />
        ),
        label: (
          <div
            className="backrest visible-on-hover"
            style={{ width: "100%", height: "100%" }}
          >
            {repo.id} 
            <Button
              type="text"
              size="small"
              shape="circle"
              className="hidden-child float-center-right"
              style={{ width: "30px", height: "30px" }}
              icon={<SettingOutlined />}
              onClick={async () => {
                const { AddRepoModal } = await import("./AddRepoModal");
                showModal(<AddRepoModal template={repo} />);
              }}
            />
          </div>
        ),
        onClick: async () => {
          navigate(`/repo/${repo.id}`);
        },
      };
    }),
  ];
  
  return [
    {
      key: "plans",
      icon: React.createElement(ScheduleOutlined),
      label: "计划",
      children: plans,
    },
    {
      key: "repos",
      icon: React.createElement(DatabaseOutlined),
      label: "仓库",
      children: repos,
    },
    {
      key: "settings",
      icon: React.createElement(SettingOutlined),
      label: "设置",
      onClick: async () => {
        const { SettingsModal } = await import("./SettingsModal");
        showModal(<SettingsModal />);
      },
    },
  ];
};

// 状态图标组件
const 图标ForResource = ({ selector }: { selector: OpSelector }) => {
  const [status, setStatus] = useState(OperationStatus.STATUS_UNKNOWN);
  
  useEffect(() => {
    if (!selector || !selector.instanceId || !selector.repoGuid) {
      return;
    }
    
    const load = async () => {
      setStatus(await getStatusForSelector(selector));
    };
    
    load();
    
    const refresh = _.debounce(load, 1000, { maxWait: 10000, trailing: true });
    
    const callback = (event?: OperationEvent, err?: Error) => {
      if (!event || !event.event) return;
      
      switch (event.event.case) {
        case "createdOperations":
        case "updatedOperations":
          const ops = event.event.value.operations;
          if (ops.find((op) => matchSelector(selector, op))) {
            refresh();
          }
          break;
        case "deletedOperations":
          refresh();
          break;
      }
    };
    
    subscribeToOperations(callback);
    
    return () => {
      unsubscribeFromOperations(callback);
    };
  }, [JSON.stringify(selector)]);
  
  return 图标For状态(status);
};

// 状态图标映射
const 图标For状态 = (status: OperationStatus) => {
  const color = colorForStatus(status);
  
  switch (status) {
    case OperationStatus.STATUS_ERROR:
      return <ExclamationOutlined style={{ color }} />;
    case OperationStatus.STATUS_WARNING:
      return <ExclamationOutlined style={{ color }} />;
    case OperationStatus.STATUS_INPROGRESS:
      return <LoadingOutlined style={{ color }} />;
    case OperationStatus.STATUS_UNKNOWN:
      return <LoadingOutlined style={{ color }} />;
    default:
      return <CheckCircleOutlined style={{ color }} />;
  }
};