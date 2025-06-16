import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Col, Form, Input, Modal, Row } from "antd";
import React, { useEffect, useState } from "react";
import { authenticationService, setAuthToken } from "../api";
import {
  LoginRequest,
  LoginRequestSchema,
} from "../../gen/ts/v1/authentication_pb";
import { useAlertApi } from "../components/Alerts";
import { create } from "@bufbuild/protobuf";

export const LoginModal = () => {
  let 默认凭证 = create(LoginRequestSchema, {});

  const [表单] = Form.useForm();
  const 提示框服务 = useAlertApi()!;

  const 提交处理 = async (表单数据: any) => {
    const 登录请求 = create(LoginRequestSchema, {
      username: 表单数据.username,
      password: 表单数据.password,
    });

    try {
      const 登录响应 = await authenticationService.login(登录请求);
      setAuthToken(登录响应.token);
      提示框服务.success("登录成功", 5);
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (错误: any) {
      提示框服务.error("登录失败：" + (错误.message ? 错误.message : "" + 错误), 10);
    }
  };

  return (
    <Modal
      open={true}
      width="40vw"
      title="登录"
      footer={null}
      closable={false}
    >
      <Form
        form={表单}
        name="horizontal_login"
        layout="inline"
        onFinish={提交处理}
        style={{ width: "100%" }}
      >
        <Row justify="center" style={{ width: "100%" }}>
          <Col span={10}>
            <Form.Item
              name="username"
              rules={[
                { required: true, message: "请输入用户名" },
              ]}
              style={{ width: "100%", paddingRight: "10px" }}
              initialValue={默认凭证.username}
            >
              <Input
                prefix={<UserOutlined className="site-form-item-icon" />}
                placeholder="用户名"
              />
            </Form.Item>
          </Col>

          <Col span={10}>
            <Form.Item
              name="password"
              rules={[
                { required: true, message: "请输入密码!" },
              ]}
              style={{ width: "100%", paddingRight: "10px" }}
              initialValue={默认凭证.password}
            >
              <Input
                prefix={<LockOutlined className="site-form-item-icon" />}
                type="password"
                placeholder="密码"
              />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Button type="primary" htmlType="submit" style={{ width: "100%" }}>
              登录
            </Button>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};